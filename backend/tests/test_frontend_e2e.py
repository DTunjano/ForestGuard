"""Opt-in browser -> Django -> real pipeline test, with isolated PostgreSQL/media."""
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from rest_framework.throttling import SimpleRateThrottle

from analyses.models import Analysis
from analyses.services import claim_next_analysis, process_analysis
from tests.test_condition_outputs import sample_scene
from tests.test_quality_policy import quality_tiff


@pytest.mark.django_db(transaction=True)
def test_frontend_full_flow(settings, tmp_path, request, monkeypatch):
    if os.getenv("FORESTGUARD_BROWSER_TEST") != "1":
        pytest.skip("Defina FORESTGUARD_BROWSER_TEST=1 para ejecutar Edge headless")
    settings.MEDIA_ROOT = tmp_path / "media"
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", {
        "anon": "10000/min", "user": "10000/min", "auth": "10000/min",
    })
    live_server = request.getfixturevalue("live_server")
    get_user_model().objects.create_user(
        username="integration_admin", email="admin@example.test", password="BrowserTest123!", role="admin",
    )
    get_user_model().objects.create_superuser(
        username="integration_root", email="root@example.test", password="BrowserTest123!",
    )
    fixtures = tmp_path / "fixtures"
    fixtures.mkdir()
    (fixtures / "scene_2024_01_01.tif").write_bytes(sample_scene())
    (fixtures / "scene_2024_03_01.tif").write_bytes(sample_scene(final=True))
    (fixtures / "invalid_2024_02_01.tif").write_bytes(b"not a raster")
    (fixtures / "cloudy_2024_02_02.tif").write_bytes(quality_tiff(59))
    frontend = Path(settings.BASE_DIR).parent / "frontend"
    node = shutil.which("node")
    assert node, "Node.js no está disponible"
    env = {**os.environ, "FORESTGUARD_API_TARGET": live_server.url,
           "FG_TEST_FILES": str(fixtures), "FG_TEST_URL": "http://127.0.0.1:5187"}
    stop = threading.Event()
    worker_errors = []

    def worker():
        try:
            while not stop.wait(.3):
                close_old_connections()
                analysis_id = claim_next_analysis()
                if analysis_id:
                    time.sleep(1)
                    analysis = Analysis.objects.get(pk=analysis_id)
                    if analysis.name == "Controlled failure":
                        Analysis.objects.filter(pk=analysis_id).update(
                            status=Analysis.Status.FAILED, error_message="Fallo controlado de prueba",
                        )
                    else:
                        process_analysis(analysis_id)
        except Exception as exc:
            worker_errors.append(type(exc).__name__)
        finally:
            close_old_connections()

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    with (tmp_path / "vite.log").open("w", encoding="utf-8") as log:
        server = subprocess.Popen([node, "node_modules/vite/bin/vite.js", "--host", "127.0.0.1",
                                   "--port", "5187", "--strictPort"], cwd=frontend, env=env,
                                  stdout=log, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            for _ in range(100):
                assert server.poll() is None, "Vite no inició; compruebe puerto 5187"
                try:
                    with urlopen(env["FG_TEST_URL"], timeout=1) as response:
                        if response.status == 200:
                            break
                except (URLError, TimeoutError):
                    time.sleep(.2)
            run = subprocess.run([node, "tests/integration.mjs"], cwd=frontend, env=env,
                                 capture_output=True, text=True, encoding="utf-8", timeout=240)
            assert run.returncode == 0, run.stdout + run.stderr
            assert not worker_errors, worker_errors
            assert Analysis.objects.filter(status="completed").count() == 2
            assert Analysis.objects.filter(status="failed").count() == 1
        finally:
            server.terminate()
            server.wait(timeout=10)
            stop.set()
            thread.join(timeout=30)

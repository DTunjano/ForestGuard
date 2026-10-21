from io import StringIO

from django.core.management import call_command

from analyses.management.commands import run_analysis_worker


def test_worker_reports_idle_state_and_stops_cleanly(monkeypatch):
    output = StringIO()
    monkeypatch.setattr(run_analysis_worker, "claim_next_analysis", lambda: None)
    monkeypatch.setattr(run_analysis_worker, "recover_stale_analyses", lambda _minutes: 0)
    monkeypatch.setattr(run_analysis_worker, "close_old_connections", lambda: None)

    def interrupt(_seconds):
        raise KeyboardInterrupt

    monkeypatch.setattr(run_analysis_worker.time, "sleep", interrupt)
    call_command("run_analysis_worker", stdout=output)

    assert "Esperando trabajos" in output.getvalue()
    assert "Worker detenido" in output.getvalue()

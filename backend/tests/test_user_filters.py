"""User filters run before pagination and use normalized role membership."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.models import RoleProfile


@pytest.mark.django_db
def test_admin_filters_by_role_ids_and_active_status_across_pages():
    User = get_user_model()
    admin = User.objects.create_user(username='filter_admin', email='filter-admin@example.test', role='admin')
    custom = Group.objects.create(name='Revisor personalizado')
    RoleProfile.objects.create(group=custom)
    expected = []
    for index in range(25):
        member = User.objects.create_user(username=f'filter_{index:02}', email=f'filter-{index}@example.test')
        member.groups.add(custom)
        expected.append(member.pk)
    disabled = User.objects.create_user(username='disabled_reviewer', email='disabled-filter@example.test', is_active=False)
    disabled.groups.set([custom])
    client = APIClient()
    client.force_authenticate(admin)
    response = client.get('/api/v1/admin/users/', {'role_id': custom.pk, 'is_active': 'true', 'ordering': 'username'})
    assert response.status_code == 200
    assert response.data['count'] == 25
    assert len(response.data['results']) == 20
    second = client.get('/api/v1/admin/users/', {'role_id': custom.pk, 'is_active': 'true', 'ordering': 'username', 'page': 2})
    assert len(second.data['results']) == 5
    assert {row['id'] for row in [*response.data['results'], *second.data['results']]} == set(expected)
    inactive = client.get('/api/v1/admin/users/', {'role_id': custom.pk, 'is_active': 'false'})
    assert inactive.data['count'] == 1 and inactive.data['results'][0]['id'] == disabled.pk
    for query in ({'role_id': 'admin'}, {'role_id': '-1'}, {'role_id': str(10**30)}, {'is_active': 'unknown'}):
        assert client.get('/api/v1/admin/users/', query).status_code == 400
    client.force_authenticate(disabled)
    assert client.get('/api/v1/admin/users/').status_code == 403
    client.force_authenticate(User.objects.get(pk=expected[0]))
    assert client.get('/api/v1/admin/users/').status_code == 403

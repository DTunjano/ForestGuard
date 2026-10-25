import django.db.models.deletion
from django.db import migrations, models


def seed_roles(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Profile = apps.get_model("accounts", "RoleProfile")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    User = apps.get_model("accounts", "User")
    resources = {
        "accounts": ("user",),
        "auth": ("group",),
        "catalog": ("studyarea", "satelliteimage", "pipelinemodel"),
        "analyses": ("analysis",),
    }
    for name in ("admin", "analyst"):
        group, _ = Group.objects.get_or_create(name=name)
        Profile.objects.get_or_create(group=group, defaults={"is_system": True})
        for app, names in resources.items():
            for model in names:
                ct, _ = ContentType.objects.get_or_create(app_label=app, model=model)
                for action in ("view", "add", "change", "delete"):
                    perm, _ = Permission.objects.get_or_create(
                        content_type=ct,
                        codename=f"{action}_{model}",
                        defaults={"name": f"Can {action} {model}"},
                    )
                    if name == "admin" or (
                        app in ("catalog", "analyses")
                        and (model != "pipelinemodel" or action == "view")
                    ):
                        group.permissions.add(perm)
        for user in User.objects.filter(role=name):
            user.groups.add(group)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial"), ("auth", "0012_alter_user_first_name_max_length")]
    operations = [
        migrations.CreateModel(
            name="RoleProfile",
            fields=[
                (
                    "group",
                    models.OneToOneField(
                        primary_key=True,
                        serialize=False,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_role",
                        to="auth.group",
                    ),
                ),
                ("description", models.TextField(blank=True, max_length=1000)),
                ("is_system", models.BooleanField(default=False, editable=False)),
            ],
        ),
        migrations.RunPython(seed_roles, migrations.RunPython.noop),
    ]

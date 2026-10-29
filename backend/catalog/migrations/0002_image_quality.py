from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]
    operations = [
        migrations.AddField(
            model_name="satelliteimage",
            name="valid_pixel_count",
            field=models.PositiveBigIntegerField(null=True, editable=False),
        ),
        migrations.AddField(
            model_name="satelliteimage",
            name="quality_check_version",
            field=models.CharField(max_length=40, blank=True, editable=False),
        ),
    ]

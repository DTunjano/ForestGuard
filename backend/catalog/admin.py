from django.contrib import admin

from .models import PipelineModel, SatelliteImage, StudyArea

admin.site.register(StudyArea)
admin.site.register(SatelliteImage)
admin.site.register(PipelineModel)

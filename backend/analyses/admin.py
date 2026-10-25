from django.contrib import admin

from .models import Analysis, AnalysisImage, ResultArtifact

admin.site.register(Analysis)
admin.site.register(AnalysisImage)
admin.site.register(ResultArtifact)

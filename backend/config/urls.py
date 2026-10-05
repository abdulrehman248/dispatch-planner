from django.urls import path

from planner.views import HealthView, LocationView, PlanView

urlpatterns = [
    path("api/health/", HealthView.as_view()),
    path("api/locations/", LocationView.as_view()),
    path("api/plan/", PlanView.as_view()),
]

import time
from fastapi import FastAPI, Request
from httpcore2 import request
from starlette.middleware.base import BaseHTTPMiddleware

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import logging

logger = logging.getLogger(__name__)

def setup_telemetry(app):
    resource = Resource.create({
        "service.name": "aegis-backend",
        "service.version": "1.0.0",
    })

    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)

    exporter = OTLPSpanExporter(
        endpoint="http://otel-collector:4317",
        insecure=True,
    )

    provider.add_span_processor(BatchSpanProcessor(exporter))

    FastAPIInstrumentor.instrument_app(app)

#========================================================================
#Get telemetry data for each request and add it to the response headers
#========================================================================

class TelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span(f"{request.method} {request.url.path}") as span:
            span.set_attribute("http.method", request.method)
            span.set_attribute("http.target", request.url.path)

            start_time = time.time()
            try:
                response = await call_next(request)
            except Exception as exc:
                span.record_exception(exc)
                raise
            
            process_time = time.time() - start_time
            endpoint = request.scope.get("endpoint")
            endpoint_name = getattr(endpoint, "__name__", "unknown")
            span.set_attribute("http.endpoint", endpoint_name)

            route = request.scope.get("route")
            if route:
                span.set_attribute("http.route", route.path)
            response.headers["X-Process-Time"] = str(process_time)
            span.set_attribute("http.status_code", response.status_code)
            return response
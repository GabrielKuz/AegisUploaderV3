import time
from fastapi import FastAPI, Request

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


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

async def telemetry_middleware(request: Request, call_next):
    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("request"):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response
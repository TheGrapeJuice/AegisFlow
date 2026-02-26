import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.routers.ws import _broadcast_loop, _inference_loop, _cascade_loop
    asyncio.create_task(_broadcast_loop())
    asyncio.create_task(_inference_loop())
    asyncio.create_task(_cascade_loop())
    yield


app = FastAPI(title="AegisFlow API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.routers.topology import router as topology_router
from backend.routers.ws import router as ws_router

app.include_router(topology_router)
app.include_router(ws_router)

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

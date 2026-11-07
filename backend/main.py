
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, jobs, users

app = FastAPI(title="FastAPI + React")


app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(users.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://link-up-jade-mu.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/hello")
def hello(name: str = "World") -> dict[str, str]:
    return {"message": f"Hello, {name}!"}





# EXERCISE (part 1): uncomment to add POST /api/user, then test it at /docs.
# from pydantic import BaseModel, EmailStr
#
#
# class User(BaseModel):
#     id: int
#     name: str
#     email: EmailStr  # invalid emails get a 422 response automatically
#
#
# @app.post("/api/user")
# def create_user(user: User) -> dict[str, str]:
#     return {"message": f"Hello {user.name} (ID {user.id}), we'll email you at {user.email}."}


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

# dist/ only exists after `npm run build`; in dev the Vite server serves the UI.
if FRONTEND_DIR.is_dir():
    app.frontend("/", directory=FRONTEND_DIR)

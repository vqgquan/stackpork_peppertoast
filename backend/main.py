from fastapi import FastAPI, Form
from typing import Annotated

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/add-customer")
async def add_customer(name: Annotated[str, Form()], age: Annotated[int, Form()], address: Annotated[str, Form()]):
    return {"name": name, "age": age, "address": address}
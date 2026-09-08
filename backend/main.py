from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import Bill

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/validate-bill")
def validate_bill(bill: Bill):
    # If the JSON body can be mapped to the Bill Pydantic model, it is valid!
    return {"status": "success", "message": "Bill successfully validated against Pydantic models."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

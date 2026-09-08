from pydantic import BaseModel, Field
from typing import List

class Confidence(BaseModel):
    name: float = Field(..., ge=0, le=1)
    quantity: float = Field(..., ge=0, le=1)
    unitPrice: float = Field(..., ge=0, le=1)
    totalPrice: float = Field(..., ge=0, le=1)

class BillItem(BaseModel):
    id: str
    name: str
    quantity: float
    unitPrice: float
    totalPrice: float
    confidence: Confidence

class BillField(BaseModel):
    value: float
    confidence: float = Field(..., ge=0, le=1)

class Bill(BaseModel):
    items: List[BillItem]
    subtotal: BillField
    gst: BillField
    serviceCharge: BillField
    discount: BillField
    printedTotal: BillField

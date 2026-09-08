from pydantic import ValidationError
from models import Bill
import json

def test_validation():
    print("Testing Pydantic validation...")

    valid_json = {
      "items": [
        {
          "id": "item1",
          "name": "Pizza",
          "quantity": 1,
          "unitPrice": 100,
          "totalPrice": 100,
          "confidence": {
            "name": 0.9,
            "quantity": 0.9,
            "unitPrice": 0.9,
            "totalPrice": 0.9
          }
        }
      ],
      "subtotal": { "value": 100, "confidence": 0.9 },
      "gst": { "value": 5, "confidence": 0.9 },
      "serviceCharge": { "value": 10, "confidence": 0.9 },
      "discount": { "value": 0, "confidence": 0.9 },
      "printedTotal": { "value": 115, "confidence": 0.9 }
    }

    try:
        bill = Bill(**valid_json)
        print("✅ Valid JSON passed Pydantic validation")
    except ValidationError as e:
        print("❌ Valid JSON failed validation!")
        exit(1)

    invalid_json = {
      "items": [
        {
          "id": "item1",
          "name": "Pizza",
          "quantity": "one", # Invalid type (should be float/int)
          "unitPrice": 100,
          "totalPrice": 100,
          "confidence": {
            "name": 0.9,
            "quantity": 0.9,
            "unitPrice": 0.9,
            "totalPrice": 0.9
          }
        }
      ],
      "subtotal": { "value": 100, "confidence": 0.9 },
      "gst": { "value": 5, "confidence": 0.9 },
      "serviceCharge": { "value": 10, "confidence": 0.9 },
      "discount": { "value": 0, "confidence": 0.9 },
      "printedTotal": { "value": 115, "confidence": 0.9 }
    }

    try:
        Bill(**invalid_json)
        print("❌ Invalid JSON passed validation! (Expected failure)")
        exit(1)
    except ValidationError as e:
        print("✅ Invalid JSON correctly failed Pydantic validation:")
        print(f"   Error snippet: {e.errors()[0]['msg']}")

if __name__ == "__main__":
    test_validation()

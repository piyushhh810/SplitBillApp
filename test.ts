import { z } from "zod";

export function testCalculations() {
  // Test scenario
  console.log("Running calculation engine tests...");
  
  // Create mock state
  const bill = {
    items: [
      { id: "i1", name: "Dosa", quantity: 1, unitPrice: 100, totalPrice: 100, confidence: {} as any },
      { id: "i2", name: "Biryani", quantity: 1, unitPrice: 300, totalPrice: 300, confidence: {} as any },
    ],
    subtotal: { value: 400, confidence: 1 },
    gst: { value: 20, confidence: 1 },
    serviceCharge: { value: 40, confidence: 1 },
    discount: { value: 60, confidence: 1 },
    printedTotal: { value: 400, confidence: 1 }
  };
  
  const people = [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" }
  ];
  
  const assignments = [
    { itemId: "i1", personIds: ["p1"] }, // Alice ate Dosa
    { itemId: "i2", personIds: ["p1", "p2"] } // Shared Biryani
  ];

  let totalAssignedFood = 0;
  const personFoodTotals: Record<string, number> = { "p1": 0, "p2": 0 };

  bill.items.forEach((item) => {
    const assignment = assignments.find((a) => a.itemId === item.id);
    if (assignment && assignment.personIds.length > 0) {
      const splitAmount = item.totalPrice / assignment.personIds.length;
      assignment.personIds.forEach((pid) => {
        personFoodTotals[pid] += splitAmount;
        totalAssignedFood += splitAmount;
      });
    }
  });

  const totalGST = bill.gst.value;
  const totalSC = bill.serviceCharge.value;
  const totalDiscount = bill.discount.value;

  let totalDistributedGST = 0;
  let totalDistributedSC = 0;
  let totalDistributedDiscount = 0;
  let totalDistributedFood = 0;

  const results = people.map((p) => {
    const food = personFoodTotals[p.id];
    const ratio = totalAssignedFood > 0 ? food / totalAssignedFood : 0;
    
    const gst = parseFloat((totalGST * ratio).toFixed(2));
    const sc = parseFloat((totalSC * ratio).toFixed(2));
    const discount = parseFloat((totalDiscount * ratio).toFixed(2));
    const foodRounded = parseFloat(food.toFixed(2));
    
    totalDistributedGST += gst;
    totalDistributedSC += sc;
    totalDistributedDiscount += discount;
    totalDistributedFood += foodRounded;

    return {
      person: p,
      food: foodRounded,
      gst,
      serviceCharge: sc,
      discount,
      finalAmount: foodRounded + gst + sc - discount,
    };
  });

  if (results.length > 0 && totalAssignedFood > 0) {
    const diffGST = totalGST - totalDistributedGST;
    const diffSC = totalSC - totalDistributedSC;
    const diffDiscount = totalDiscount - totalDistributedDiscount;
    const diffFood = totalAssignedFood - totalDistributedFood;

    const firstPerson = results[0];
    
    firstPerson.gst = parseFloat((firstPerson.gst + diffGST).toFixed(2));
    firstPerson.serviceCharge = parseFloat((firstPerson.serviceCharge + diffSC).toFixed(2));
    firstPerson.discount = parseFloat((firstPerson.discount + diffDiscount).toFixed(2));
    firstPerson.food = parseFloat((firstPerson.food + diffFood).toFixed(2));
    
    firstPerson.finalAmount = firstPerson.food + firstPerson.gst + firstPerson.serviceCharge - firstPerson.discount;
  }

  console.log(JSON.stringify(results, null, 2));
  
  const sumFinal = results.reduce((a, b) => a + b.finalAmount, 0);
  console.log("Calculated bill total (Food + GST + SC - Discount):", 400 + 20 + 40 - 60);
  console.log("Sum of split totals:", sumFinal);
  if (Math.abs(sumFinal - 400) > 0.01) {
    console.error("TEST FAILED: Mismatch in totals");
    process.exit(1);
  }
  console.log("TEST PASSED");
}

testCalculations();

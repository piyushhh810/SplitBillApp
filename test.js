"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCalculations = testCalculations;
function testCalculations() {
    // Test scenario
    console.log("Running calculation engine tests...");
    // Create mock state
    var bill = {
        items: [
            { id: "i1", name: "Dosa", quantity: 1, unitPrice: 100, totalPrice: 100, confidence: {} },
            { id: "i2", name: "Biryani", quantity: 1, unitPrice: 300, totalPrice: 300, confidence: {} },
        ],
        subtotal: { value: 400, confidence: 1 },
        gst: { value: 20, confidence: 1 },
        serviceCharge: { value: 40, confidence: 1 },
        discount: { value: 60, confidence: 1 },
        printedTotal: { value: 400, confidence: 1 }
    };
    var people = [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" }
    ];
    var assignments = [
        { itemId: "i1", personIds: ["p1"] }, // Alice ate Dosa
        { itemId: "i2", personIds: ["p1", "p2"] } // Shared Biryani
    ];
    var totalAssignedFood = 0;
    var personFoodTotals = { "p1": 0, "p2": 0 };
    bill.items.forEach(function (item) {
        var assignment = assignments.find(function (a) { return a.itemId === item.id; });
        if (assignment && assignment.personIds.length > 0) {
            var splitAmount_1 = item.totalPrice / assignment.personIds.length;
            assignment.personIds.forEach(function (pid) {
                personFoodTotals[pid] += splitAmount_1;
                totalAssignedFood += splitAmount_1;
            });
        }
    });
    var totalGST = bill.gst.value;
    var totalSC = bill.serviceCharge.value;
    var totalDiscount = bill.discount.value;
    var totalDistributedGST = 0;
    var totalDistributedSC = 0;
    var totalDistributedDiscount = 0;
    var totalDistributedFood = 0;
    var results = people.map(function (p) {
        var food = personFoodTotals[p.id];
        var ratio = totalAssignedFood > 0 ? food / totalAssignedFood : 0;
        var gst = parseFloat((totalGST * ratio).toFixed(2));
        var sc = parseFloat((totalSC * ratio).toFixed(2));
        var discount = parseFloat((totalDiscount * ratio).toFixed(2));
        var foodRounded = parseFloat(food.toFixed(2));
        totalDistributedGST += gst;
        totalDistributedSC += sc;
        totalDistributedDiscount += discount;
        totalDistributedFood += foodRounded;
        return {
            person: p,
            food: foodRounded,
            gst: gst,
            serviceCharge: sc,
            discount: discount,
            finalAmount: foodRounded + gst + sc - discount,
        };
    });
    if (results.length > 0 && totalAssignedFood > 0) {
        var diffGST = totalGST - totalDistributedGST;
        var diffSC = totalSC - totalDistributedSC;
        var diffDiscount = totalDiscount - totalDistributedDiscount;
        var diffFood = totalAssignedFood - totalDistributedFood;
        var firstPerson = results[0];
        firstPerson.gst = parseFloat((firstPerson.gst + diffGST).toFixed(2));
        firstPerson.serviceCharge = parseFloat((firstPerson.serviceCharge + diffSC).toFixed(2));
        firstPerson.discount = parseFloat((firstPerson.discount + diffDiscount).toFixed(2));
        firstPerson.food = parseFloat((firstPerson.food + diffFood).toFixed(2));
        firstPerson.finalAmount = firstPerson.food + firstPerson.gst + firstPerson.serviceCharge - firstPerson.discount;
    }
    console.log(JSON.stringify(results, null, 2));
    var sumFinal = results.reduce(function (a, b) { return a + b.finalAmount; }, 0);
    console.log("Calculated bill total (Food + GST + SC - Discount):", 400 + 20 + 40 - 60);
    console.log("Sum of split totals:", sumFinal);
    if (Math.abs(sumFinal - 400) > 0.01) {
        console.error("TEST FAILED: Mismatch in totals");
        process.exit(1);
    }
    console.log("TEST PASSED");
}
testCalculations();

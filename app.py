from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Sample medicine data
medicines = [
    {
        "id": 1,
        "name": "Dolo 650",
        "composition": "Paracetamol 650mg",
        "type": "Branded",
        "form": "Tablet",
        "quantity": "10 Tablets",
        "manufacturer": "Micro Labs Ltd",
        "prices": [
            {"platform": "1mg", "price": 24.90, "availability": "In Stock"},
            {"platform": "Netmeds", "price": 26.50, "availability": "In Stock"},
            {"platform": "Apollo", "price": 25.75, "availability": "In Stock"}
        ]
    },
    {
        "id": 2,
        "name": "Paracetamol 650",
        "composition": "Paracetamol 650mg",
        "type": "Generic",
        "form": "Tablet",
        "quantity": "10 Tablets",
        "manufacturer": "Generic Pharma",
        "prices": [
            {"platform": "1mg", "price": 14.50, "availability": "In Stock"},
            {"platform": "Netmeds", "price": 15.20, "availability": "In Stock"},
            {"platform": "Apollo", "price": 14.80, "availability": "In Stock"}
        ]
    },
    {
        "id": 3,
        "name": "Crocin Advance",
        "composition": "Paracetamol 500mg",
        "type": "Branded",
        "form": "Tablet",
        "quantity": "15 Tablets",
        "manufacturer": "GSK Pharma",
        "prices": [
            {"platform": "1mg", "price": 18.75, "availability": "In Stock"},
            {"platform": "Netmeds", "price": 19.50, "availability": "In Stock"},
            {"platform": "Apollo", "price": 18.90, "availability": "In Stock"}
        ]
    }
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/medicine-search')
def medicine_search():
    return render_template('index.html')  # Reuse index.html for now

@app.route('/generic-alternatives')
def generic_alternatives():
    return render_template('index.html')  # Reuse index.html for now

@app.route('/savings-calculator')
def savings_calculator():
    return render_template('index.html')  # Reuse index.html for now

@app.route('/about-us')
def about_us():
    return render_template('index.html')  # Reuse index.html for now

@app.route('/api/medicines', methods=['GET'])
def search_medicines():
    try:
        query = request.args.get('query', '').lower()
        logging.debug(f"Search query: {query}")
        results = medicines if not query else [
            med for med in medicines
            if query in med['name'].lower() or query in med['composition'].lower()
        ]
        logging.debug(f"Returning results: {results}")
        return jsonify(results)
    except Exception as e:
        logging.error(f"Error in search_medicines: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/medicines/<int:medicine_id>', methods=['GET'])
def get_medicine(medicine_id):
    try:
        medicine = next((med for med in medicines if med['id'] == medicine_id), None)
        if not medicine:
            return jsonify({"error": "Medicine not found"}), 404
        return jsonify(medicine)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/calculate-savings', methods=['POST'])
def calculate_savings():
    try:
        data = request.get_json()
        medicine_name = data.get('medicine_name', '').lower()
        quantity = data.get('quantity', 1)
        medicine = next((med for med in medicines if medicine_name in med['name'].lower()), None)
        if not medicine:
            return jsonify({"error": "Medicine not found"}), 404
        related_medicines = [
            med for med in medicines
            if med['composition'].lower() == medicine['composition'].lower()
        ]
        current_cost = min(price['price'] for price in medicine['prices']) * quantity
        best_platform_cost = min(
            min(price['price'] for price in med['prices']) * quantity
            for med in related_medicines
        )
        generic_cost = min(
            min(price['price'] for price in med['prices']) * quantity
            for med in related_medicines if med['type'] == 'Generic'
        ) if any(med['type'] == 'Generic' for med in related_medicines) else None
        savings = {
            "current_cost": round(current_cost, 2),
            "best_platform_cost": round(best_platform_cost, 2),
            "generic_cost": round(generic_cost, 2) if generic_cost else None,
            "potential_savings": round(current_cost - (generic_cost or best_platform_cost), 2)
        }
        return jsonify(savings)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/price-comparison/<int:medicine_id>', methods=['GET'])
def price_comparison(medicine_id):
    try:
        medicine = next((med for med in medicines if med['id'] == medicine_id), None)
        if not medicine:
            return jsonify({"error": "Medicine not found"}), 404
        generic = next(
            (med for med in medicines if med['composition'] == medicine['composition'] and med['type'] == 'Generic'),
            None
        )
        platforms = [price['platform'] for price in medicine['prices']]
        prices = [price['price'] for price in medicine['prices']]
        if generic:
            platforms.append('Generic')
            prices.append(min(price['price'] for price in generic['prices']))
        return jsonify({"labels": platforms, "prices": prices})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/platforms-comparison', methods=['GET'])
def platforms_comparison():
    try:
        labels = [med['name'] for med in medicines]
        datasets = [
            {
                "label": platform,
                "data": [
                    next((p['price'] for p in med['prices'] if p['platform'] == platform), 0)
                    for med in medicines
                ]
            }
            for platform in ['1mg', 'Netmeds', 'Apollo']
        ]
        return jsonify({"labels": labels, "datasets": datasets})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/savings-comparison', methods=['GET'])
def savings_comparison():
    try:
        labels = []
        branded_data = []
        generic_data = []
        compositions = set(med['composition'] for med in medicines)
        for comp in compositions:
            branded = next((med for med in medicines if med['composition'] == comp and med['type'] == 'Branded'), None)
            generic = next((med for med in medicines if med['composition'] == comp and med['type'] == 'Generic'), None)
            if branded:
                labels.append(comp)
                branded_data.append(min(price['price'] for price in branded['prices']))
                generic_data.append(min(price['price'] for price in generic['prices']) if generic else 0)
        datasets = [
            {"label": "Branded", "data": branded_data},
            {"label": "Generic", "data": generic_data}
        ]
        return jsonify({"labels": labels, "datasets": datasets})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
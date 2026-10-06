// Pharmacy sites to probe. `searchUrl` opens the site's own search page (what a user sees after pressing Enter).
// If no JSON price request is captured there, the script falls back to typing into the homepage search box.
export const SITES = [
  { id: 'tata1mg', home: 'https://www.1mg.com/', searchUrl: (q) => `https://www.1mg.com/search/all?name=${encodeURIComponent(q)}` },
  { id: 'pharmeasy', home: 'https://pharmeasy.in/', searchUrl: (q) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}` },
  { id: 'netmeds', home: 'https://www.netmeds.com/', searchUrl: (q) => `https://www.netmeds.com/products?q=${encodeURIComponent(q)}` },
  { id: 'apollo', home: 'https://www.apollopharmacy.in/', searchUrl: (q) => `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(q)}` },
  { id: 'truemeds', home: 'https://www.truemeds.in/', searchUrl: (q) => `https://www.truemeds.in/search/${encodeURIComponent(q)}` },
  { id: 'platinumrx', home: 'https://www.platinumrx.in/' },
  { id: 'dawaadost', home: 'https://www.dawaadost.com/' },
  { id: 'medkart', home: 'https://www.medkart.in/' },
  { id: 'genericaadhaar', home: 'https://www.genericaadhaar.com/' },
  { id: 'davaindia', home: 'https://www.davaindia.com/' },
  { id: 'zeelab', home: 'https://www.zeelabpharmacy.com/' },
  { id: 'mrmed', home: 'https://www.mrmed.in/' },
  { id: 'sastasundar', home: 'https://www.sastasundar.com/' },
  { id: 'healthmug', home: 'https://www.healthmug.com/' },
  { id: 'medplus', home: 'https://www.medplusmart.com/' },
  { id: 'wellnessforever', home: 'https://www.wellnessforever.com/' },
];

// Two locations used to test how location-sensitive prices are.
export const LOCATIONS = [
  { label: 'Gurgaon', pin: '122001', city: 'Gurgaon', state: 'Haryana', lat: '28.4595', lng: '77.0266' },
  { label: 'Mumbai', pin: '400001', city: 'Mumbai', state: 'Maharashtra', lat: '18.9388', lng: '72.8354' },
];

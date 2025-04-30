document.addEventListener('DOMContentLoaded', () => {
    // Modal
    const modal = document.getElementById('comparison-modal');
    const closeModal = document.querySelector('.modal-close');
    const modalTableBody = document.querySelector('.comparison-table tbody');
    let priceChartInstance = null; // Store the chart instance

    function openModal(medicineId, medicineName) {
        document.getElementById('modal-medicine-name').textContent = medicineName;
        modal.classList.add('active');
        fetchPriceComparison(medicineId);
    }

    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
        modalTableBody.innerHTML = '';
        if (priceChartInstance) {
            priceChartInstance.destroy(); // Destroy chart instance on close
            priceChartInstance = null;
        }
        const canvas = document.getElementById('price-chart');
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal.click();
    });

    // Search
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('medicine-search');
    const medicineGrid = document.querySelector('.medicine-grid');
    const searchForm = document.getElementById('search-form');
    const sortSelect = document.querySelector('.filter-select');

    if (!searchBtn || !searchInput || !medicineGrid || !searchForm || !sortSelect) {
        console.error('Search button, input, grid, form, or sort select not found:', { searchBtn, searchInput, medicineGrid, searchForm, sortSelect });
        return;
    }

    async function fetchMedicines(query = '') {
        medicineGrid.innerHTML = '<div class="skeleton-loader" style="grid-column: 1/-1; height: 200px;"></div>';
        try {
            const response = await fetch(`/api/medicines?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Network error');
            const medicines = await response.json();
            renderMedicines(medicines, sortSelect.value);
            if (query.trim()) {
                document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            medicineGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error loading medicines.</p>';
            console.error('Fetch medicines error:', error);
        }
    }

    function renderMedicines(medicines, sortOption) {
        let sortedMedicines = [...medicines];
        switch (sortOption) {
            case 'low-to-high':
                sortedMedicines.sort((a, b) => Math.min(...a.prices.map(p => p.price)) - Math.min(...b.prices.map(p => p.price)));
                break;
            case 'high-to-low':
                sortedMedicines.sort((a, b) => Math.min(...b.prices.map(p => p.price)) - Math.min(...a.prices.map(p => p.price)));
                break;
            case 'popularity':
                sortedMedicines.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }

        medicineGrid.innerHTML = sortedMedicines.length ? '' : '<p style="grid-column: 1/-1; text-align: center;">No results found.</p>';
        sortedMedicines.forEach(med => {
            const card = document.createElement('div');
            card.className = 'medicine-card';
            card.innerHTML = `
                <div class="medicine-image">
                    <img src="/static/images/placeholder_300x150.png" alt="${med.name}">
                </div>
                <div class="medicine-content">
                    <h3 class="medicine-name">${med.name}</h3>
                    <p class="medicine-composition">${med.composition}</p>
                    <div class="medicine-price-container">
                        <span class="medicine-price">₹${Math.min(...med.prices.map(p => p.price)).toFixed(2)}</span>
                        <span class="${med.type.toLowerCase()}-badge">${med.type}</span>
                    </div>
                    <div class="medicine-platforms">
                        ${med.prices.map(p => `<span class="platform-badge">${p.platform}</span>`).join('')}
                    </div>
                    <div class="medicine-actions">
                        <button class="compare-btn" data-id="${med.id}">Compare Prices</button>
                    </div>
                </div>
            `;
            medicineGrid.appendChild(card);
        });

        document.querySelectorAll('.compare-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.closest('.medicine-card').querySelector('.medicine-name').textContent;
                openModal(id, name);
            });
        });
    }

    let debounceTimer;
    searchBtn.addEventListener('click', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchMedicines(searchInput.value.trim());
        }, 300);
    });

    // Handle Enter key press on input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchMedicines(searchInput.value.trim());
            }, 300);
        }
    });

    // Handle sort selection
    sortSelect.addEventListener('change', () => {
        fetchMedicines(searchInput.value.trim());
    });

    // Initial load with try-catch, no scroll
    try {
        fetchMedicines();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        medicineGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error loading initial medicines.</p>';
        console.error('Initial fetch error:', error);
    }

    // Price comparison
    async function fetchPriceComparison(medicineId) {
        modalTableBody.innerHTML = '<tr><td colspan="4"><div class="skeleton-loader" style="height: 40px;"></div></td></tr>';
        try {
            const response = await fetch(`/api/price-comparison/${medicineId}`);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            modalTableBody.innerHTML = '';
            const minPrice = Math.min(...data.prices);
            data.labels.forEach((platform, i) => {
                const price = data.prices[i];
                const savings = platform === 'Generic' ? (data.prices[0] - price).toFixed(2) : 'Base';
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${platform}</td>
                    <td class="${price === minPrice ? 'price-highlight' : ''}">₹${price.toFixed(2)}</td>
                    <td>In Stock</td>
                    <td class="${savings > 0 ? 'savings-highlight' : ''}">
                        ${savings > 0 ? `Save ₹${savings}` : savings}
                    </td>
                `;
                modalTableBody.appendChild(row);
            });
            if (typeof Chart !== 'undefined') {
                // Destroy existing chart if it exists
                if (priceChartInstance) {
                    priceChartInstance.destroy();
                }
                const canvas = document.getElementById('price-chart');
                priceChartInstance = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: 'Price (₹)',
                            data: data.prices,
                            backgroundColor: data.labels.map(label => label === 'Generic' ? 'rgba(34,197,94,0.7)' : 'rgba(37,99,235,0.7)'),
                            borderColor: data.labels.map(label => label === 'Generic' ? 'rgba(34,197,94,1)' : 'rgba(37,99,235,1)'),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: { y: { beginAtZero: true } },
                        plugins: { legend: { display: false } }
                    }
                });
            } else {
                document.getElementById('price-chart').parentElement.innerHTML = '<p>Chart unavailable.</p>';
            }
        } catch (error) {
            modalTableBody.innerHTML = '<tr><td colspan="4">Error loading data.</td></tr>';
            console.error(error);
        }
    }

    // Platform chart
    function initPlatformsChart() {
        if (typeof Chart === 'undefined') {
            document.getElementById('platforms-chart').parentElement.innerHTML = '<p>Chart unavailable.</p>';
            return;
        }
        fetch('/api/platforms-comparison')
            .then(res => res.json())
            .then(data => {
                new Chart(document.getElementById('platforms-chart'), {
                    type: 'bar',
                    data: {
                        labels: data.labels,
                        datasets: data.datasets.map(ds => ({
                            label: ds.label,
                            data: ds.data,
                            backgroundColor: {
                                '1mg': 'rgba(37,99,235,0.7)',
                                'Netmeds': 'rgba(6,182,212,0.7)',
                                'Apollo': 'rgba(139,92,246,0.7)'
                            }[ds.label],
                            borderColor: {
                                '1mg': 'rgba(37,99,235,1)',
                                'Netmeds': 'rgba(6,182,212,1)',
                                'Apollo': 'rgba(139,92,246,1)'
                            }[ds.label],
                            borderWidth: 1
                        }))
                    },
                    options: {
                        scales: { y: { beginAtZero: true } }
                    }
                });
            })
            .catch(() => {
                document.getElementById('platforms-chart').parentElement.innerHTML = '<p>Chart unavailable.</p>';
            });
    }

    // Savings chart
    function initSavingsChart() {
        if (typeof Chart === 'undefined') {
            document.getElementById('savings-chart').parentElement.innerHTML = '<p>Chart unavailable.</p>';
            return;
        }
        fetch('/api/savings-comparison')
            .then(res => res.json())
            .then(data => {
                new Chart(document.getElementById('savings-chart'), {
                    type: 'bar',
                    data: {
                        labels: data.labels,
                        datasets: data.datasets.map(ds => ({
                            label: ds.label,
                            data: ds.data,
                            backgroundColor: ds.label === 'Generic' ? 'rgba(34,197,94,0.7)' : 'rgba(37,99,235,0.7)',
                            borderColor: ds.label === 'Generic' ? 'rgba(34,197,94,1)' : 'rgba(37,99,235,1)',
                            borderWidth: 1
                        }))
                    },
                    options: {
                        scales: { y: { beginAtZero: true } }
                    }
                });
            })
            .catch(() => {
                document.getElementById('savings-chart').parentElement.innerHTML = '<p>Chart unavailable.</p>';
            });
    }

    // Calculator
    const calculateBtn = document.getElementById('calculate-btn');
    const calculatorResults = document.querySelector('.calculator-results');

    calculateBtn.addEventListener('click', async () => {
        const name = document.getElementById('med-name').value.trim();
        const quantity = parseInt(document.getElementById('med-quantity').value) || 1;
        if (!name) {
            alert('Enter a medicine name');
            return;
        }
        calculatorResults.innerHTML = '<div class="skeleton-loader" style="grid-column: 1/-1; height: 100px;"></div>';
        try {
            const response = await fetch('/api/calculate-savings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medicine_name: name, quantity })
            });
            if (!response.ok) throw new Error('Network error');
            const result = await response.json();
            if (result.error) {
                calculatorResults.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">${result.error}</p>`;
                return;
            }
            calculatorResults.innerHTML = `
                <div class="result-card">
                    <div class="result-title">Current Cost</div>
                    <div class="result-value">₹${result.current_cost || 'N/A'}</div>
                </div>
                <div class="result-card">
                    <div class="result-title">Best Platform</div>
                    <div class="result-value">₹${result.best_platform_cost}</div>
                </div>
                <div class="result-card highlight">
                    <div class="result-title">Generic Cost</div>
                    <div class="result-value">₹${result.generic_cost || 'N/A'}</div>
                </div>
                <div class="result-card">
                    <div class="result-title">Savings</div>
                    <div class="result-value">₹${result.potential_savings}</div>
                </div>
            `;
        } catch (error) {
            calculatorResults.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error calculating savings.</p>';
            console.error(error);
        }
    });

    // Testimonial slider
    const slider = document.querySelector('.testimonial-slider');
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        slider.scrollLeft = scrollLeft - (x - startX);
    });

    // Newsletter
    const newsletterForm = document.querySelector('.newsletter-form');
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = newsletterForm.querySelector('.newsletter-input').value;
        alert(email ? 'Subscribed!' : 'Enter a valid email.');
        if (email) newsletterForm.reset();
    });

    // Lazy-load charts
    const visualizations = document.querySelector('.visualizations');
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            initPlatformsChart();
            initSavingsChart();
            observer.disconnect();
        }
    }, { threshold: 0.1 });
    observer.observe(visualizations);

    // Animations
    const animateElements = document.querySelectorAll('.animate-fadeIn');
    function checkVisibility() {
        animateElements.forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 50) {
                el.classList.add('animated');
            }
        });
    }
    window.addEventListener('scroll', checkVisibility);
    checkVisibility();
});
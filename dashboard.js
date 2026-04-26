let rawData = [];
let filteredData = [];

// Configuration
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4', '#f43f5e', '#8b5cf6'];

document.addEventListener('DOMContentLoaded', () => {
    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
        fileUpload.addEventListener('change', handleFileUpload);
    }

    // Add filter listeners
    const filters = ['filter-date-start', 'filter-date-end', 'filter-navire', 'filter-agence', 'filter-stock', 'filter-produit'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                updateDashboard();
                updateFilterOptions();
            });
        }
    });

    const resetBtn = document.getElementById('reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }

    // AUTO-LOAD base.json
    autoLoadData();
});

/**
 * Attempts to load base.json automatically on startup
 */
async function autoLoadData() {
    try {
        const response = await fetch('base.json');
        if (response.ok) {
            const text = await response.text();
            // Remove BOM and trim
            const cleanText = text.trim().replace(/^\uFEFF/, '');
            rawData = JSON.parse(cleanText);

            if (Array.isArray(rawData)) {
                initFilters();
                updateDashboard();
                console.log("Données chargées automatiquement depuis base.json");
            }
        }
    } catch (e) {
        console.warn("Auto-load base.json bypassed or failed (CORS or 404). Manual upload may be required.");
    }
}

/**
 * Handles manual file upload
 */
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileNameEl = document.getElementById('file-name');
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('dashboard-content');

    if (fileNameEl) fileNameEl.textContent = `Fichier : ${file.name}`;
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const text = event.target.result;
            const cleanText = text.trim().replace(/^\uFEFF/, '');
            rawData = JSON.parse(cleanText);

            if (!Array.isArray(rawData)) {
                throw new Error("Le fichier JSON doit contenir un tableau d'objets.");
            }

            initFilters();
            updateDashboard();
        } catch (error) {
            console.error("JSON Error:", error);
            alert("Erreur lors de la lecture du fichier JSON : " + error.message + "\nAssurez-vous qu'il s'agit d'un format valide (tableau d'objets).");
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    };

    reader.onerror = function() {
        alert("Erreur de lecture du fichier.");
        if (loadingEl) loadingEl.classList.add('hidden');
    };

    reader.readAsText(file);
}

/**
 * Initializes filter options from the full dataset
 */
function initFilters() {
    if (!rawData || rawData.length === 0) return;

    const navires = [...new Set(rawData.map(d => d.Navires))].filter(Boolean).sort();
    const agences = [...new Set(rawData.map(d => d.Agence))].filter(Boolean).sort();
    const stocks = [...new Set(rawData.map(d => d.Stock))].filter(Boolean).sort();
    const produits = [...new Set(rawData.map(d => d.Produit))].filter(Boolean).sort();

    const dates = rawData.map(d => parseDate(d.Date)).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return;

    let minDate = dates[0];
    let maxDate = dates[0];
    dates.forEach(d => {
        if (d < minDate) minDate = d;
        if (d > maxDate) maxDate = d;
    });

    populateSelect('filter-navire', navires);
    populateSelect('filter-agence', agences);
    populateSelect('filter-stock', stocks);
    populateSelect('filter-produit', produits);

    const startInput = document.getElementById('filter-date-start');
    const endInput = document.getElementById('filter-date-end');

    if (startInput) startInput.value = minDate.toISOString().split('T')[0];
    if (endInput) endInput.value = maxDate.toISOString().split('T')[0];
}

/**
 * Updates filter options based on current selections (interdependence)
 */
function updateFilterOptions() {
    const update = (id, field) => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentSelected = Array.from(select.selectedOptions).map(o => o.value);

        // Interdependence logic: get available options based on CURRENT filters EXCEPT this one
        const tempFiltered = rawData.filter(d => {
            const startDateStr = document.getElementById('filter-date-start').value;
            const endDateStr = document.getElementById('filter-date-end').value;
            const startNum = startDateStr ? new Date(startDateStr).getTime() : -Infinity;
            const endNum = endDateStr ? new Date(endDateStr).getTime() : Infinity;

            const dDate = parseDate(d.Date);
            const dTime = dDate.getTime();
            if (dTime < startNum || dTime > endNum) return false;

            if (id !== 'filter-navire') {
                const s = Array.from(document.getElementById('filter-navire').selectedOptions).map(o => o.value);
                if (s.length > 0 && !s.includes(d.Navires)) return false;
            }
            if (id !== 'filter-agence') {
                const s = Array.from(document.getElementById('filter-agence').selectedOptions).map(o => o.value);
                if (s.length > 0 && !s.includes(d.Agence)) return false;
            }
            if (id !== 'filter-stock') {
                const s = Array.from(document.getElementById('filter-stock').selectedOptions).map(o => o.value);
                if (s.length > 0 && !s.includes(d.Stock)) return false;
            }
            if (id !== 'filter-produit') {
                const s = Array.from(document.getElementById('filter-produit').selectedOptions).map(o => o.value);
                if (s.length > 0 && !s.includes(d.Produit)) return false;
            }
            return true;
        });

        const available = [...new Set(tempFiltered.map(d => d[field]))].filter(Boolean).sort();
        const fullList = [...new Set(rawData.map(d => d[field]))].filter(Boolean).sort();

        const scroll = select.scrollTop;
        select.innerHTML = '';
        fullList.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            if (currentSelected.includes(item)) opt.selected = true;
            if (!available.includes(item)) {
                opt.classList.add('text-gray-300');
                opt.disabled = true;
            }
            select.appendChild(opt);
        });
        select.scrollTop = scroll;
    };

    update('filter-navire', 'Navires');
    update('filter-agence', 'Agence');
    update('filter-stock', 'Stock');
    update('filter-produit', 'Produit');
}

function populateSelect(id, items) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '';
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        select.appendChild(opt);
    });
}

function resetFilters() {
    initFilters();
    updateDashboard();
}

/**
 * Parses date string in M/D/YYYY format as UTC midnight
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date(NaN);
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(NaN);
    // Data is M/D/YYYY
    const [m, d, y] = parts.map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Core update function to refresh all UI elements
 */
function updateDashboard() {
    applyFilters();
    renderKPIs();
    renderSynthesis();
    renderAllCharts();

    const content = document.getElementById('dashboard-content');
    if (content) content.classList.remove('hidden');

    window.dispatchEvent(new Event('resize'));
}

/**
 * Filters the rawData based on UI selections
 */
function applyFilters() {
    const startDateStr = document.getElementById('filter-date-start').value;
    const endDateStr = document.getElementById('filter-date-end').value;
    const startNum = startDateStr ? new Date(startDateStr).getTime() : -Infinity;
    const endNum = endDateStr ? new Date(endDateStr).getTime() : Infinity;

    const selNavires = Array.from(document.getElementById('filter-navire')?.selectedOptions || []).map(o => o.value);
    const selAgences = Array.from(document.getElementById('filter-agence')?.selectedOptions || []).map(o => o.value);
    const selStocks = Array.from(document.getElementById('filter-stock')?.selectedOptions || []).map(o => o.value);
    const selProduits = Array.from(document.getElementById('filter-produit')?.selectedOptions || []).map(o => o.value);

    filteredData = rawData.filter(d => {
        const dDate = parseDate(d.Date);
        const dTime = dDate.getTime();
        const matchDate = dTime >= startNum && dTime <= endNum;
        const matchNavire = selNavires.length === 0 || selNavires.includes(d.Navires);
        const matchAgence = selAgences.length === 0 || selAgences.includes(d.Agence);
        const matchStock = selStocks.length === 0 || selStocks.includes(d.Stock);
        const matchProduit = selProduits.length === 0 || selProduits.includes(d.Produit);
        return matchDate && matchNavire && matchAgence && matchStock && matchProduit;
    });
}

/**
 * Calculates the average interval (in minutes) between trucks
 */
function calculateInterTruckInterval(data) {
    if (data.length < 2) return 0;

    const byDate = {};
    data.forEach(d => {
        if (!byDate[d.Date]) byDate[d.Date] = [];
        byDate[d.Date].push(d);
    });

    let intervals = [];
    Object.values(byDate).forEach(dayRecords => {
        dayRecords.sort((a, b) => (a['Heure sortie'] || "").localeCompare(b['Heure sortie'] || ""));
        for (let i = 1; i < dayRecords.length; i++) {
            const h1 = dayRecords[i-1]['Heure sortie'];
            const h2 = dayRecords[i]['Heure sortie'];
            if (!h1 || !h2) continue;

            const t1 = h1.split(':').map(Number);
            const t2 = h2.split(':').map(Number);
            if (t1.length < 2 || t2.length < 2) continue;

            const diffMin = (t2[0]*60 + t2[1] + (t2[2]||0)/60) - (t1[0]*60 + t1[1] + (t1[2]||0)/60);
            if (diffMin > 0 && diffMin < 120) { // Exclude gaps > 2h as non-operational
                intervals.push(diffMin);
            }
        }
    });

    return intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
}

/**
 * Renders the top 5 KPI cards
 */
function renderKPIs() {
    const totalTonnage = filteredData.reduce((s, d) => s + (parseFloat(d.Tonnage) || 0), 0);
    const totalEnvois = filteredData.length;
    const avgLoad = totalEnvois > 0 ? totalTonnage / totalEnvois : 0;
    const activeTrucks = new Set(filteredData.map(d => d.Matricule)).size;
    const avgInterval = calculateInterTruckInterval(filteredData);

    const setKPI = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setKPI('kpi-total-tonnage', totalTonnage.toLocaleString(undefined, {maximumFractionDigits: 1}) + ' T');
    setKPI('kpi-total-envois', totalEnvois.toLocaleString());
    setKPI('kpi-avg-tonnage', avgLoad.toLocaleString(undefined, {maximumFractionDigits: 2}) + ' T');
    setKPI('kpi-active-trucks', activeTrucks.toLocaleString());
    setKPI('kpi-avg-interval', avgInterval.toFixed(2) + ' min');
}

/**
 * Generates the automated performance synthesis
 */
function renderSynthesis() {
    const container = document.getElementById('synthesis-content');
    if (!container) return;

    if (filteredData.length === 0) {
        container.innerHTML = "<p class='col-span-2 text-center py-8 text-blue-300 italic'>Aucune donnée ne correspond aux filtres sélectionnés.</p>";
        return;
    }

    const dates = filteredData.map(d => parseDate(d.Date));
    const minD = new Date(Math.min(...dates)).toLocaleDateString('fr-FR');
    const maxD = new Date(Math.max(...dates)).toLocaleDateString('fr-FR');
    const count = filteredData.length;

    // Executive Summary
    const uniqueDaysCount = new Set(filteredData.map(d => d.Date)).size || 1;
    document.getElementById('syn-exec').textContent = `Les ${count.toLocaleString()} envois enregistrés couvrent la période du ${minD} au ${maxD}. Le port d'Agadir a traité un flux continu de marchandises avec une moyenne de ${(count / uniqueDaysCount).toFixed(1)} envois par jour actif.`;

    // Agencies
    const agencyCounts = countBy(filteredData, 'Agence');
    const sortedAgencies = Object.entries(agencyCounts).sort((a,b) => b[1] - a[1]);
    let agText = sortedAgencies.map(([name, val]) => `${name} domine avec ${((val/count)*100).toFixed(1)}% des envois (${val} passages)`).join(', ') + '.';
    document.getElementById('syn-agencies').textContent = agText;

    // Stocks
    const stockCounts = countBy(filteredData, 'Stock');
    const topStock = Object.entries(stockCounts).sort((a,b) => b[1] - a[1])[0];
    document.getElementById('syn-stocks').textContent = `${Object.keys(stockCounts).length} entrepôts actifs. ${topStock[0]} est la destination principale (${((topStock[1]/count)*100).toFixed(1)}% des flux).`;

    // Trucks
    const truckCounts = countBy(filteredData, 'Matricule');
    const topTrucks = Object.entries(truckCounts).sort((a,b) => b[1] - a[1]).slice(0, 2);
    const truckAgency = (m) => filteredData.find(d => d.Matricule === m)?.Agence || 'Inconnu';

    let trHtml = topTrucks.map(([m, c]) => `
        <div class="flex justify-between items-center bg-blue-800/30 p-2 rounded">
            <span>🚛 ${m} <span class="text-[10px] opacity-60 ml-2">(${truckAgency(m)})</span></span>
            <span class="font-bold">${c} passages</span>
        </div>
    `).join('');
    document.getElementById('syn-trucks').innerHTML = trHtml;

    const lowActivity = Object.entries(truckCounts).filter(t => t[1] === 1);
    document.getElementById('syn-low-activity').textContent = `⚠️ ${lowActivity.length} camions n'ont effectué qu'un seul passage durant cette période.`;
}

function countBy(data, key) {
    const res = {};
    data.forEach(d => { res[d[key]] = (res[d[key]] || 0) + 1; });
    return res;
}

function aggregate(data, key, valKey) {
    const res = {};
    data.forEach(d => { res[d[key]] = (res[d[key]] || 0) + (parseFloat(d[valKey]) || 0); });
    return res;
}

/**
 * Main entry point for rendering all Plotly charts
 */
function renderAllCharts() {
    if (typeof Plotly === 'undefined') return;

    const layoutBase = {
        margin: { t: 10, b: 30, l: 40, r: 10 },
        font: { family: 'Inter, sans-serif', size: 10 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };

    const tonByDay = aggregate(filteredData, 'Date', 'Tonnage');
    const sortedDays = Object.keys(tonByDay).sort((a,b) => parseDate(a) - parseDate(b));

    // 2. Daily Tonnage Trend
    Plotly.newPlot('chart-tonnage-time', [{
        x: sortedDays,
        y: sortedDays.map(d => tonByDay[d]),
        type: 'scatter', fill: 'tozeroy', line: { color: COLORS[0], width: 3 }
    }], layoutBase);

    // 3. Agency Share
    const tonByAg = aggregate(filteredData, 'Agence', 'Tonnage');
    Plotly.newPlot('chart-agency-share', [{
        labels: Object.keys(tonByAg),
        values: Object.values(tonByAg),
        type: 'pie', hole: 0.6, marker: { colors: COLORS }
    }], { ...layoutBase, showlegend: true });

    // 4. Product Breakdown
    const prodCounts = countBy(filteredData, 'Produit');
    Plotly.newPlot('chart-product-breakdown', [{
        x: Object.keys(prodCounts),
        y: Object.values(prodCounts),
        type: 'bar', marker: { color: COLORS[1] }
    }], layoutBase);

    // 5. Stock Tonnage
    const tonByStock = aggregate(filteredData, 'Stock', 'Tonnage');
    const sortedStocks = Object.entries(tonByStock).sort((a,b) => b[1]-a[1]);
    Plotly.newPlot('chart-stock-tonnage', [{
        y: sortedStocks.map(s => s[0]),
        x: sortedStocks.map(s => s[1]),
        type: 'bar', orientation: 'h', marker: { color: COLORS[2] }
    }], { ...layoutBase, margin: { ...layoutBase.margin, l: 100 } });

    // 6. Top Trucks
    const truckData = {};
    filteredData.forEach(d => {
        if(!truckData[d.Matricule]) truckData[d.Matricule] = { tonnage: 0, agence: d.Agence };
        truckData[d.Matricule].tonnage += parseFloat(d.Tonnage) || 0;
    });
    const top10Trucks = Object.entries(truckData).sort((a,b) => b[1].tonnage - a[1].tonnage).slice(0, 10);
    const agToColor = (ag) => COLORS[['BADI', 'MACOMAM', 'SOTA'].indexOf(ag) % COLORS.length] || '#94a3b8';

    Plotly.newPlot('chart-top-trucks', [{
        y: top10Trucks.map(t => t[0]),
        x: top10Trucks.map(t => t[1].tonnage),
        text: top10Trucks.map(t => t[1].agence),
        type: 'bar', orientation: 'h',
        marker: { color: top10Trucks.map(t => agToColor(t[1].agence)) }
    }], { ...layoutBase, margin: { ...layoutBase.margin, l: 80 } });

    // 7. Tonnage by Vessel
    const tonByVessel = aggregate(filteredData, 'Navires', 'Tonnage');
    Plotly.newPlot('chart-vessel-tonnage', [{
        x: Object.keys(tonByVessel),
        y: Object.values(tonByVessel),
        type: 'bar', marker: { color: COLORS[4] }
    }], layoutBase);

    // 8. Hourly Activity
    const hourCounts = {};
    filteredData.forEach(d => {
        const hStr = d['Heure sortie'] || "00:00";
        const h = hStr.split(':')[0] + 'h';
        hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const sortedHours = Object.keys(hourCounts).sort((a,b) => parseInt(a) - parseInt(b));
    Plotly.newPlot('chart-hourly-activity', [{
        x: sortedHours,
        y: sortedHours.map(h => hourCounts[h]),
        type: 'bar', marker: { color: COLORS[5] }
    }], layoutBase);

    // 10. Load Distribution
    Plotly.newPlot('chart-load-distribution', [{
        y: filteredData.map(d => parseFloat(d.Tonnage)),
        type: 'box', marker: { color: COLORS[6] }
    }], layoutBase);

    // 11. Agency x Product Matrix
    const matrix = {};
    const ags = [...new Set(filteredData.map(d => d.Agence))].filter(Boolean);
    const prods = [...new Set(filteredData.map(d => d.Produit))].filter(Boolean);
    ags.forEach(a => {
        matrix[a] = {};
        prods.forEach(p => matrix[a][p] = 0);
    });
    filteredData.forEach(d => {
        if (d.Agence && d.Produit) matrix[d.Agence][d.Produit] += parseFloat(d.Tonnage) || 0;
    });

    const matrixTraces = ags.map((a, i) => ({
        name: a,
        x: prods,
        y: prods.map(p => matrix[a][p]),
        type: 'bar',
        marker: { color: COLORS[i % COLORS.length] }
    }));
    Plotly.newPlot('chart-agency-product-matrix', matrixTraces, { ...layoutBase, barmode: 'stack', showlegend: true });

    // 12. Truck Utilization
    const tripsByTruck = countBy(filteredData, 'Matricule');
    const sortedTrips = Object.entries(tripsByTruck).sort((a,b) => b[1]-a[1]).slice(0, 20);
    Plotly.newPlot('chart-truck-utilization', [{
        x: sortedTrips.map(t => t[0]),
        y: sortedTrips.map(t => t[1]),
        type: 'bar', marker: { color: COLORS[7] }
    }], layoutBase);

    // 13. Load Efficiency
    const countByDay = countBy(filteredData, 'Date');
    const avgLoadByDay = {};
    Object.keys(countByDay).forEach(day => {
        const tonOnDay = filteredData.filter(d => d.Date === day).reduce((s,d) => s + (parseFloat(d.Tonnage)||0), 0);
        avgLoadByDay[day] = tonOnDay / countByDay[day];
    });
    Plotly.newPlot('chart-load-efficiency-time', [{
        x: sortedDays,
        y: sortedDays.map(d => avgLoadByDay[d]),
        type: 'scatter', mode: 'lines+markers', line: { color: COLORS[1] }
    }], layoutBase);

    // 16. Inter-Truck Interval Trend
    const intervalByDay = {};
    const byDateGroup = {};
    filteredData.forEach(d => {
        if (!byDateGroup[d.Date]) byDateGroup[d.Date] = [];
        byDateGroup[d.Date].push(d);
    });
    Object.keys(byDateGroup).forEach(day => {
        intervalByDay[day] = calculateInterTruckInterval(byDateGroup[day]);
    });
    Plotly.newPlot('chart-inter-truck-interval-time', [{
        x: sortedDays,
        y: sortedDays.map(d => intervalByDay[d]),
        type: 'scatter', mode: 'lines+markers', line: { color: COLORS[4] }
    }], layoutBase);

    // 15. Low Activity
    const truckTripsMap = {};
    filteredData.forEach(d => {
        if(!truckTripsMap[d.Matricule]) truckTripsMap[d.Matricule] = { count: 0, agence: d.Agence };
        truckTripsMap[d.Matricule].count++;
    });
    const lowActivityList = Object.entries(truckTripsMap).sort((a,b) => a[1].count - b[1].count).slice(0, 10);

    Plotly.newPlot('chart-low-activity-trucks', [{
        y: lowActivityList.map(t => t[0]),
        x: lowActivityList.map(t => t[1].count),
        text: lowActivityList.map(t => t[1].agence),
        type: 'bar', orientation: 'h', marker: { color: '#cbd5e1' }
    }], { ...layoutBase, margin: { ...layoutBase.margin, l: 80 } });

    // 14. Vessel Timeline
    const vesselRanges = {};
    filteredData.forEach(d => {
        if (!vesselRanges[d.Navires]) vesselRanges[d.Navires] = { start: parseDate(d.Date), end: parseDate(d.Date) };
        const dDate = parseDate(d.Date);
        if (dDate < vesselRanges[d.Navires].start) vesselRanges[d.Navires].start = dDate;
        if (dDate > vesselRanges[d.Navires].end) vesselRanges[d.Navires].end = dDate;
    });
    const vesselTraces = Object.entries(vesselRanges).map(([name, range]) => ({
        name: name,
        x: [range.start.toISOString().split('T')[0], range.end.toISOString().split('T')[0]],
        y: [name, name],
        type: 'scatter', mode: 'lines+markers', line: { width: 15, color: COLORS[0] }, marker: { size: 16 }
    }));
    Plotly.newPlot('chart-vessel-timeline', vesselTraces, { ...layoutBase, margin: { ...layoutBase.margin, l: 120 } });

    // 9. CALENDAR HEATMAP (Weeks x Days)
    renderCalendarHeatmap(sortedDays, countByDay, layoutBase);
}

/**
 * Custom renderer for GitHub-style calendar heatmap
 */
function renderCalendarHeatmap(sortedDays, countByDay, layout) {
    if (sortedDays.length === 0) return;

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const reversedDayNames = ['Sam', 'Ven', 'Jeu', 'Mer', 'Mar', 'Lun', 'Dim'];

    const firstDate = parseDate(sortedDays[0]);
    const lastDate = parseDate(sortedDays[sortedDays.length - 1]);

    const dataMap = {};
    sortedDays.forEach(d => dataMap[d] = countByDay[d]);

    // Go to start of first week
    let current = new Date(firstDate);
    current.setUTCDate(current.getUTCDate() - current.getUTCDay());

    const weeks = [];
    while (current <= lastDate) {
        weeks.push(new Date(current));
        current.setUTCDate(current.getUTCDate() + 7);
    }

    const z = [];
    reversedDayNames.forEach((dayName) => {
        const row = [];
        const dayIdx = dayNames.indexOf(dayName);
        weeks.forEach(weekStart => {
            const d = new Date(weekStart);
            d.setUTCDate(d.getUTCDate() + dayIdx);
            const key = `${d.getUTCMonth()+1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
            row.push(dataMap[key] || 0);
        });
        z.push(row);
    });

    const weekLabels = weeks.map(w => w.toLocaleDateString('fr-FR', {month:'short', day:'numeric'}));

    Plotly.newPlot('chart-calendar-heatmap', [{
        z: z,
        x: weekLabels,
        y: reversedDayNames,
        type: 'heatmap',
        colorscale: 'Greens',
        showscale: false,
        xgap: 2,
        ygap: 2,
        hoverongaps: false
    }], { ...layout, margin: { ...layout.margin, l: 40 } });
}

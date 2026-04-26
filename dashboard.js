let rawData = [];
let filteredData = [];

// Configuration
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4', '#f43f5e', '#8b5cf6'];

document.addEventListener('DOMContentLoaded', () => {
    const fileUpload = document.getElementById('file-upload');
    fileUpload.addEventListener('change', handleFileUpload);

    // Add filter listeners
    const filters = ['filter-date-start', 'filter-date-end', 'filter-navire', 'filter-agence', 'filter-stock', 'filter-produit'];
    filters.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            updateDashboard();
            updateFilterOptions();
        });
    });

    document.getElementById('reset-filters').addEventListener('click', resetFilters);

    // AUTO-LOAD base.json
    autoLoadData();
});

async function autoLoadData() {
    try {
        const response = await fetch('base.json');
        if (response.ok) {
            rawData = await response.json();
            initFilters();
            updateDashboard();
        }
    } catch (e) {
        console.log("Auto-load base.json bypassed or failed (normal in some environments).");
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = `Fichier : ${file.name}`;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            rawData = JSON.parse(e.target.result);
            initFilters();
            updateDashboard();
        } catch (error) {
            console.error("JSON Error:", error);
            alert("Erreur lors de la lecture du fichier JSON.");
        } finally {
            document.getElementById('loading').classList.add('hidden');
        }
    };
    reader.readAsText(file);
}

function initFilters() {
    const navires = [...new Set(rawData.map(d => d.Navires))].sort();
    const agences = [...new Set(rawData.map(d => d.Agence))].sort();
    const stocks = [...new Set(rawData.map(d => d.Stock))].sort();
    const produits = [...new Set(rawData.map(d => d.Produit))].sort();
    const dates = rawData.map(d => parseDate(d.Date)).filter(d => !isNaN(d));

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    populateSelect('filter-navire', navires);
    populateSelect('filter-agence', agences);
    populateSelect('filter-stock', stocks);
    populateSelect('filter-produit', produits);

    document.getElementById('filter-date-start').value = minDate.toISOString().split('T')[0];
    document.getElementById('filter-date-end').value = maxDate.toISOString().split('T')[0];
}

function updateFilterOptions() {
    const update = (id, field) => {
        const select = document.getElementById(id);
        const currentSelected = Array.from(select.selectedOptions).map(o => o.value);

        // Interdependence logic: get available options based on CURRENT filters EXCEPT this one
        const tempFiltered = rawData.filter(d => {
            const startDate = new Date(document.getElementById('filter-date-start').value);
            const endDate = new Date(document.getElementById('filter-date-end').value);
            const dDate = parseDate(d.Date);
            if (dDate < startDate || dDate > endDate) return false;

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

        const available = [...new Set(tempFiltered.map(d => d[field]))].sort();
        const fullList = [...new Set(rawData.map(d => d[field]))].sort();

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

function parseDate(dateStr) {
    if (!dateStr) return new Date(NaN);
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
}

function updateDashboard() {
    applyFilters();
    renderKPIs();
    renderSynthesis();
    renderAllCharts();
    document.getElementById('dashboard-content').classList.remove('hidden');
    window.dispatchEvent(new Event('resize'));
}

function applyFilters() {
    const startDate = new Date(document.getElementById('filter-date-start').value);
    const endDate = new Date(document.getElementById('filter-date-end').value);
    const selNavires = Array.from(document.getElementById('filter-navire').selectedOptions).map(o => o.value);
    const selAgences = Array.from(document.getElementById('filter-agence').selectedOptions).map(o => o.value);
    const selStocks = Array.from(document.getElementById('filter-stock').selectedOptions).map(o => o.value);
    const selProduits = Array.from(document.getElementById('filter-produit').selectedOptions).map(o => o.value);

    filteredData = rawData.filter(d => {
        const dDate = parseDate(d.Date);
        const matchDate = dDate >= startDate && dDate <= endDate;
        const matchNavire = selNavires.length === 0 || selNavires.includes(d.Navires);
        const matchAgence = selAgences.length === 0 || selAgences.includes(d.Agence);
        const matchStock = selStocks.length === 0 || selStocks.includes(d.Stock);
        const matchProduit = selProduits.length === 0 || selProduits.includes(d.Produit);
        return matchDate && matchNavire && matchAgence && matchStock && matchProduit;
    });
}

function calculateInterTruckInterval(data) {
    if (data.length < 2) return 0;

    const byDate = {};
    data.forEach(d => {
        if (!byDate[d.Date]) byDate[d.Date] = [];
        byDate[d.Date].push(d);
    });

    let intervals = [];
    Object.values(byDate).forEach(dayRecords => {
        dayRecords.sort((a, b) => a['Heure sortie'].localeCompare(b['Heure sortie']));
        for (let i = 1; i < dayRecords.length; i++) {
            const t1 = dayRecords[i-1]['Heure sortie'].split(':').map(Number);
            const t2 = dayRecords[i]['Heure sortie'].split(':').map(Number);
            const diffMin = (t2[0]*60 + t2[1] + t2[2]/60) - (t1[0]*60 + t1[1] + t1[2]/60);
            if (diffMin > 0 && diffMin < 120) {
                intervals.push(diffMin);
            }
        }
    });

    return intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
}

function renderKPIs() {
    const totalTonnage = filteredData.reduce((s, d) => s + (parseFloat(d.Tonnage) || 0), 0);
    const totalEnvois = filteredData.length;
    const avgLoad = totalEnvois > 0 ? totalTonnage / totalEnvois : 0;
    const activeTrucks = new Set(filteredData.map(d => d.Matricule)).size;
    const avgInterval = calculateInterTruckInterval(filteredData);

    document.getElementById('kpi-total-tonnage').textContent = totalTonnage.toLocaleString(undefined, {maximumFractionDigits: 1}) + ' T';
    document.getElementById('kpi-total-envois').textContent = totalEnvois.toLocaleString();
    document.getElementById('kpi-avg-tonnage').textContent = avgLoad.toLocaleString(undefined, {maximumFractionDigits: 2}) + ' T';
    document.getElementById('kpi-active-trucks').textContent = activeTrucks.toLocaleString();
    document.getElementById('kpi-avg-interval').textContent = avgInterval.toFixed(2) + ' min';
}

function renderSynthesis() {
    if (filteredData.length === 0) {
        document.getElementById('synthesis-content').innerHTML = "<p class='col-span-2 text-center py-8 text-blue-300 italic'>Aucune donnée ne correspond aux filtres sélectionnés.</p>";
        return;
    }

    const dates = filteredData.map(d => parseDate(d.Date));
    const minD = new Date(Math.min(...dates)).toLocaleDateString('fr-FR');
    const maxD = new Date(Math.max(...dates)).toLocaleDateString('fr-FR');
    const count = filteredData.length;

    document.getElementById('syn-exec').textContent = `Les ${count.toLocaleString()} envois enregistrés couvrent la période du ${minD} au ${maxD}. Le port d'Agadir a traité un flux continu de marchandises avec une moyenne de ${(count / (new Set(filteredData.map(d => d.Date)).size || 1)).toFixed(1)} envois par jour actif.`;

    const agencyCounts = countBy(filteredData, 'Agence');
    const sortedAgencies = Object.entries(agencyCounts).sort((a,b) => b[1] - a[1]);
    let agText = sortedAgencies.map(([name, val]) => `${name} domine avec ${((val/count)*100).toFixed(1)}% des envois (${val} passages)`).join(', ') + '.';
    document.getElementById('syn-agencies').textContent = agText;

    const stockCounts = countBy(filteredData, 'Stock');
    const topStock = Object.entries(stockCounts).sort((a,b) => b[1] - a[1])[0];
    document.getElementById('syn-stocks').textContent = `${Object.keys(stockCounts).length} entrepôts actifs. ${topStock[0]} est la destination principale (${((topStock[1]/count)*100).toFixed(1)}% des flux).`;

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

function renderAllCharts() {
    const layout = {
        margin: { t: 10, b: 30, l: 40, r: 10 },
        font: { family: 'Inter, sans-serif', size: 10 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };

    const tonByDay = aggregate(filteredData, 'Date', 'Tonnage');
    const sortedDays = Object.keys(tonByDay).sort((a,b) => parseDate(a) - parseDate(b));

    Plotly.newPlot('chart-tonnage-time', [{
        x: sortedDays,
        y: sortedDays.map(d => tonByDay[d]),
        type: 'scatter', fill: 'tozeroy', line: { color: COLORS[0], width: 3 }
    }], layout);

    const tonByAg = aggregate(filteredData, 'Agence', 'Tonnage');
    Plotly.newPlot('chart-agency-share', [{
        labels: Object.keys(tonByAg),
        values: Object.values(tonByAg),
        type: 'pie', hole: 0.6, marker: { colors: COLORS }
    }], { ...layout, showlegend: true });

    const prodCounts = countBy(filteredData, 'Produit');
    Plotly.newPlot('chart-product-breakdown', [{
        x: Object.keys(prodCounts),
        y: Object.values(prodCounts),
        type: 'bar', marker: { color: COLORS[1] }
    }], layout);

    const tonByStock = aggregate(filteredData, 'Stock', 'Tonnage');
    const sortedStocks = Object.entries(tonByStock).sort((a,b) => b[1]-a[1]);
    Plotly.newPlot('chart-stock-tonnage', [{
        y: sortedStocks.map(s => s[0]),
        x: sortedStocks.map(s => s[1]),
        type: 'bar', orientation: 'h', marker: { color: COLORS[2] }
    }], { ...layout, margin: { ...layout.margin, l: 100 } });

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
    }], { ...layout, margin: { ...layout.margin, l: 80 } });

    const tonByVessel = aggregate(filteredData, 'Navires', 'Tonnage');
    Plotly.newPlot('chart-vessel-tonnage', [{
        x: Object.keys(tonByVessel),
        y: Object.values(tonByVessel),
        type: 'bar', marker: { color: COLORS[4] }
    }], layout);

    const hourCounts = {};
    filteredData.forEach(d => {
        const h = d['Heure sortie'].split(':')[0] + 'h';
        hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const sortedHours = Object.keys(hourCounts).sort((a,b) => parseInt(a) - parseInt(b));
    Plotly.newPlot('chart-hourly-activity', [{
        x: sortedHours,
        y: sortedHours.map(h => hourCounts[h]),
        type: 'bar', marker: { color: COLORS[5] }
    }], layout);

    Plotly.newPlot('chart-load-distribution', [{
        y: filteredData.map(d => parseFloat(d.Tonnage)),
        type: 'box', marker: { color: COLORS[6] }
    }], layout);

    const matrix = {};
    const ags = [...new Set(filteredData.map(d => d.Agence))];
    const prods = [...new Set(filteredData.map(d => d.Produit))];
    ags.forEach(a => {
        matrix[a] = {};
        prods.forEach(p => matrix[a][p] = 0);
    });
    filteredData.forEach(d => { matrix[d.Agence][d.Produit] += parseFloat(d.Tonnage) || 0; });

    const matrixTraces = ags.map((a, i) => ({
        name: a,
        x: prods,
        y: prods.map(p => matrix[a][p]),
        type: 'bar',
        marker: { color: COLORS[i % COLORS.length] }
    }));
    Plotly.newPlot('chart-agency-product-matrix', matrixTraces, { ...layout, barmode: 'stack', showlegend: true });

    const tripsByTruck = countBy(filteredData, 'Matricule');
    const sortedTrips = Object.entries(tripsByTruck).sort((a,b) => b[1]-a[1]).slice(0, 20);
    Plotly.newPlot('chart-truck-utilization', [{
        x: sortedTrips.map(t => t[0]),
        y: sortedTrips.map(t => t[1]),
        type: 'bar', marker: { color: COLORS[7] }
    }], layout);

    const avgLoadByDay = {};
    const countByDay = countBy(filteredData, 'Date');
    const tonByDay2 = aggregate(filteredData, 'Date', 'Tonnage');
    Object.keys(countByDay).forEach(day => {
        avgLoadByDay[day] = tonByDay2[day] / countByDay[day];
    });
    Plotly.newPlot('chart-load-efficiency-time', [{
        x: sortedDays,
        y: sortedDays.map(d => avgLoadByDay[d]),
        type: 'scatter', mode: 'lines+markers', line: { color: COLORS[1] }
    }], layout);

    const intervalByDay = {};
    const byDate = {};
    filteredData.forEach(d => {
        if (!byDate[d.Date]) byDate[d.Date] = [];
        byDate[d.Date].push(d);
    });
    Object.keys(byDate).forEach(day => {
        intervalByDay[day] = calculateInterTruckInterval(byDate[day]);
    });
    Plotly.newPlot('chart-inter-truck-interval-time', [{
        x: sortedDays,
        y: sortedDays.map(d => intervalByDay[d]),
        type: 'scatter', mode: 'lines+markers', line: { color: COLORS[4] }
    }], layout);

    const truckTrips = {};
    filteredData.forEach(d => {
        if(!truckTrips[d.Matricule]) truckTrips[d.Matricule] = { count: 0, agence: d.Agence };
        truckTrips[d.Matricule].count++;
    });
    const lowActivity = Object.entries(truckTrips).sort((a,b) => a[1].count - b[1].count).slice(0, 10);

    Plotly.newPlot('chart-low-activity-trucks', [{
        y: lowActivity.map(t => t[0]),
        x: lowActivity.map(t => t[1].count),
        text: lowActivity.map(t => t[1].agence),
        type: 'bar', orientation: 'h', marker: { color: '#cbd5e1' }
    }], { ...layout, margin: { ...layout.margin, l: 80 } });

    const vesselTimes = {};
    filteredData.forEach(d => {
        if (!vesselTimes[d.Navires]) vesselTimes[d.Navires] = { start: parseDate(d.Date), end: parseDate(d.Date) };
        const dDate = parseDate(d.Date);
        if (dDate < vesselTimes[d.Navires].start) vesselTimes[d.Navires].start = dDate;
        if (dDate > vesselTimes[d.Navires].end) vesselTimes[d.Navires].end = dDate;
    });
    const vesselTraces = Object.entries(vesselTimes).map(([name, range]) => ({
        name: name,
        x: [range.start.toISOString().split('T')[0], range.end.toISOString().split('T')[0]],
        y: [name, name],
        type: 'scatter', mode: 'lines+markers', line: { width: 15, color: COLORS[0] }, marker: { size: 16 }
    }));
    Plotly.newPlot('chart-vessel-timeline', vesselTraces, { ...layout, margin: { ...layout.margin, l: 120 } });

    // 9. CALENDAR HEATMAP (Weeks x Days)
    renderHeatmap(sortedDays, countByDay, layout);
}

function renderHeatmap(sortedDays, countByDay, layout) {
    if (sortedDays.length === 0) return;

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const reversedDayNames = ['Sam', 'Ven', 'Jeu', 'Mer', 'Mar', 'Lun', 'Dim'];

    // Get all dates in range
    const firstDate = parseDate(sortedDays[0]);
    const lastDate = parseDate(sortedDays[sortedDays.length - 1]);

    const z = []; // Tonnage/Trips counts
    const x = []; // Weeks
    const y = reversedDayNames;

    // Build a map for easy lookup
    const dataMap = {};
    sortedDays.forEach(d => dataMap[d] = countByDay[d]);

    // Group into weeks
    let current = new Date(firstDate);
    current.setDate(current.getDate() - current.getDay()); // Go to start of week (Sunday)

    const weeks = [];
    while (current <= lastDate) {
        weeks.push(new Date(current));
        current.setDate(current.getDate() + 7);
    }

    reversedDayNames.forEach((dayName, dy) => {
        const row = [];
        const dayIdx = dayNames.indexOf(dayName);
        weeks.forEach(weekStart => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + dayIdx);
            const key = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
            row.push(dataMap[key] || 0);
        });
        z.push(row);
    });

    const weekLabels = weeks.map(w => w.toLocaleDateString('fr-FR', {month:'short', day:'numeric'}));

    Plotly.newPlot('chart-calendar-heatmap', [{
        z: z,
        x: weekLabels,
        y: y,
        type: 'heatmap',
        colorscale: 'Greens',
        showscale: false,
        xgap: 2,
        ygap: 2
    }], { ...layout, margin: { ...layout.margin, l: 40 } });
}

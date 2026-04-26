document.getElementById('file-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = `Fichier : ${file.name}`;
    document.getElementById('loading').style.display = 'block';
    document.getElementById('dashboard-content').style.display = 'none';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            processData(data);
        } catch (error) {
            console.error("Erreur de parsing JSON:", error);
            alert("Erreur lors de la lecture du fichier JSON. Assurez-vous qu'il s'agit d'un format valide.");
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    };
    reader.readAsText(file);
});

/**
 * Helper to parse dates in D/M/YYYY format
 */
function parseDate(dateStr) {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Helper to sort date strings (D/M/YYYY)
 */
function sortDateStrings(dateList) {
    return [...dateList].sort((a, b) => parseDate(a) - parseDate(b));
}

function processData(data) {
    if (!Array.isArray(data)) {
        alert("Le format des données doit être un tableau d'objets.");
        return;
    }

    // 1. KPI Calculations
    const totalEnvois = data.length;
    const totalTonnage = data.reduce((sum, item) => sum + (parseFloat(item.Tonnage) || 0), 0);
    const avgTonnage = totalTonnage / totalEnvois;
    const uniqueDrivers = new Set(data.map(item => item.Chauffeur)).size;

    document.getElementById('kpi-total-envois').textContent = totalEnvois.toLocaleString();
    document.getElementById('kpi-total-tonnage').textContent = totalTonnage.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('kpi-avg-tonnage').textContent = avgTonnage.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('kpi-unique-drivers').textContent = uniqueDrivers.toLocaleString();

    // 2. Data Aggregations

    // By Agency
    const byAgency = aggregate(data, 'Agence', 'Tonnage');
    const envoisByAgency = countBy(data, 'Agence');

    // By Date
    const byDate = aggregate(data, 'Date', 'Tonnage');
    const sortedDates = sortDateStrings(Object.keys(byDate));

    const envoisByDate = countBy(data, 'Date');

    // Hourly Distribution
    const hourlyDist = countBy(data, item => {
        const timeStr = item['Heure sortie'];
        if (!timeStr) return 'Inconnu';
        const hour = timeStr.split(':')[0];
        return hour.padStart(2, '0') + 'h';
    });

    // By Stock
    const byStock = aggregate(data, 'Stock', 'Tonnage');

    // By Product
    const envoisByProduct = countBy(data, 'Produit');

    // Top 10 Drivers
    const driversCount = countBy(data, 'Chauffeur');
    const topDrivers = Object.entries(driversCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    // Avg Tonnage by Agency
    const avgTonnageByAgency = {};
    Object.keys(byAgency).forEach(agency => {
        avgTonnageByAgency[agency] = byAgency[agency] / envoisByAgency[agency];
    });

    // Agency vs Stock
    const agencyStock = crossAggregate(data, 'Agence', 'Stock');

    const tonnageByProduct = aggregate(data, 'Produit', 'Tonnage');
    const envoisByStock = countBy(data, 'Stock');

    // Render Charts
    renderCharts({
        byAgency, envoisByAgency, byDate, sortedDates, envoisByDate,
        hourlyDist, byStock, envoisByProduct, topDrivers,
        avgTonnageByAgency, agencyStock, allData: data,
        tonnageByProduct, envoisByStock
    });

    document.getElementById('dashboard-content').style.display = 'block';
    window.dispatchEvent(new Event('resize')); // Force plotly to resize
}

function aggregate(data, key, valueKey) {
    const result = {};
    data.forEach(item => {
        const k = typeof key === 'function' ? key(item) : item[key];
        result[k] = (result[k] || 0) + (parseFloat(item[valueKey]) || 0);
    });
    return result;
}

function countBy(data, key) {
    const result = {};
    data.forEach(item => {
        const k = typeof key === 'function' ? key(item) : item[key];
        result[k] = (result[k] || 0) + 1;
    });
    return result;
}

function crossAggregate(data, key1, key2) {
    const result = {};
    data.forEach(item => {
        const k1 = item[key1];
        const k2 = item[key2];
        if (!result[k1]) result[k1] = {};
        result[k1][k2] = (result[k1][k2] || 0) + 1;
    });
    return result;
}

function renderCharts(processed) {
    const commonLayout = {
        margin: { t: 30, b: 40, l: 50, r: 20 },
        font: { family: 'Inter, sans-serif' }
    };

    // 1. Tonnage by Agency (Pie)
    Plotly.newPlot('chart-tonnage-agence', [{
        labels: Object.keys(processed.byAgency),
        values: Object.values(processed.byAgency),
        type: 'pie',
        hole: 0.4,
        marker: { colors: ['#1a56db', '#0e9f6e', '#ff5a1f', '#7e3af2'] }
    }], { ...commonLayout, showlegend: true });

    // 2. Envois by Agency (Bar)
    Plotly.newPlot('chart-envois-agence', [{
        x: Object.keys(processed.envoisByAgency),
        y: Object.values(processed.envoisByAgency),
        type: 'bar',
        marker: { color: '#1a56db' }
    }], commonLayout);

    // 3. Evolution du Tonnage par Jour (Line)
    Plotly.newPlot('chart-tonnage-time', [{
        x: processed.sortedDates,
        y: processed.sortedDates.map(d => processed.byDate[d]),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#0e9f6e', width: 3 },
        marker: { size: 8 }
    }], { ...commonLayout, xaxis: { title: 'Date' }, yaxis: { title: 'Tonnage' } });

    // 4. Volume d'envois par Jour (Line)
    Plotly.newPlot('chart-envois-time', [{
        x: processed.sortedDates,
        y: processed.sortedDates.map(d => processed.envoisByDate[d]),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#1a56db', width: 3 },
        marker: { size: 8 }
    }], { ...commonLayout, xaxis: { title: 'Date' }, yaxis: { title: 'Nombre d\'envois' } });

    // 5. Distribution Horaire (Bar)
    const hours = Object.keys(processed.hourlyDist).sort();
    Plotly.newPlot('chart-hourly-dist', [{
        x: hours,
        y: hours.map(h => processed.hourlyDist[h]),
        type: 'bar',
        marker: { color: '#7e3af2' }
    }], { ...commonLayout, xaxis: { title: 'Heure de sortie' } });

    // 6. Tonnage par Stock (Bar)
    Plotly.newPlot('chart-tonnage-stock', [{
        x: Object.keys(processed.byStock),
        y: Object.values(processed.byStock),
        type: 'bar',
        marker: { color: '#ff5a1f' }
    }], { ...commonLayout, xaxis: { title: 'Stock' } });

    // 7. Nombre d'envois par Produit (Bar)
    Plotly.newPlot('chart-envois-produit', [{
        x: Object.keys(processed.envoisByProduct),
        y: Object.values(processed.envoisByProduct),
        type: 'bar',
        marker: { color: '#1a56db' }
    }], { ...commonLayout, xaxis: { title: 'Produit' } });

    // 8. Top 10 Chauffeurs (H-Bar)
    Plotly.newPlot('chart-top-drivers', [{
        y: processed.topDrivers.map(d => d[0]).reverse(),
        x: processed.topDrivers.map(d => d[1]).reverse(),
        type: 'bar',
        orientation: 'h',
        marker: { color: '#0e9f6e' }
    }], { ...commonLayout, margin: { ...commonLayout.margin, l: 150 } });

    // 9. Tonnage Moyen par Agence (Bar)
    Plotly.newPlot('chart-avg-tonnage-agence', [{
        x: Object.keys(processed.avgTonnageByAgency),
        y: Object.values(processed.avgTonnageByAgency),
        type: 'bar',
        marker: { color: '#7e3af2' }
    }], { ...commonLayout, yaxis: { title: 'Tonnage Moyen' } });

    // 10. Distribution du Tonnage (Box Plot)
    Plotly.newPlot('chart-tonnage-box', [{
        y: processed.allData.map(item => parseFloat(item.Tonnage)),
        type: 'box',
        name: 'Tonnage',
        marker: { color: '#ff5a1f' }
    }], commonLayout);

    // 11. Tonnage par Produit (Bar)
    Plotly.newPlot('chart-tonnage-produit', [{
        x: Object.keys(processed.tonnageByProduct),
        y: Object.values(processed.tonnageByProduct),
        type: 'bar',
        marker: { color: '#0e9f6e' }
    }], { ...commonLayout, xaxis: { title: 'Produit' } });

    // 12. Nombre d'envois par Stock (Bar)
    Plotly.newPlot('chart-envois-stock', [{
        x: Object.keys(processed.envoisByStock),
        y: Object.values(processed.envoisByStock),
        type: 'bar',
        marker: { color: '#1a56db' }
    }], { ...commonLayout, xaxis: { title: 'Stock' } });

    // 13. Tonnage Cumulé (Area)
    let cumulative = 0;
    const cumulativeTonnage = processed.sortedDates.map(date => {
        cumulative += processed.byDate[date];
        return cumulative;
    });
    Plotly.newPlot('chart-cumulative-tonnage', [{
        x: processed.sortedDates,
        y: cumulativeTonnage,
        type: 'scatter',
        mode: 'lines',
        fill: 'tozeroy',
        line: { color: '#1a56db' }
    }], { ...commonLayout, yaxis: { title: 'Tonnage Cumulé' } });

    // 14. Agence vs Stock (Grouped Bar)
    const agencies = Object.keys(processed.agencyStock);
    const stocks = [...new Set(processed.allData.map(item => item.Stock))];
    const traces = agencies.map(agency => ({
        name: agency,
        x: stocks,
        y: stocks.map(stock => processed.agencyStock[agency][stock] || 0),
        type: 'bar'
    }));
    Plotly.newPlot('chart-agence-stock', traces, { ...commonLayout, barmode: 'group' });
}

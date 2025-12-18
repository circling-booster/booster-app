(function (window) {

    class ChartManager {
        static createLineChart(canvasId, labels, data, label = 'API 호출') {
            const ctx = document.getElementById(canvasId)?.getContext('2d');
            if (!ctx) return null;

            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label,
                        data,
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        static createBarChart(canvasId, labels, datasets) {
            const ctx = document.getElementById(canvasId)?.getContext('2d');
            if (!ctx) return null;

            return new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: datasets.map((ds, idx) => ({
                        label: ds.label,
                        data: ds.data,
                        backgroundColor: UI_CONFIG.CHART_COLORS[idx % UI_CONFIG.CHART_COLORS.length]
                    }))
                },
                options: {
                    responsive: true,
                    indexAxis: 'y',
                    plugins: {
                        legend: {
                            display: true
                        }
                    }
                }
            });
        }

        static createPieChart(canvasId, labels, data) {
            const ctx = document.getElementById(canvasId)?.getContext('2d');
            if (!ctx) return null;

            return new Chart(ctx, {
                type: 'pie',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: UI_CONFIG.CHART_COLORS
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        static createDoughnutChart(canvasId, labels, data) {
            const ctx = document.getElementById(canvasId)?.getContext('2d');
            if (!ctx) return null;

            return new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: UI_CONFIG.CHART_COLORS
                    }]
                },
                options: {
                    responsive: true
                }
            });
        }
    }

   // 전역 객체에 할당
    window.ChartManager = ChartManager;
})(window);
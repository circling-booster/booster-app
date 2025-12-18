// 차트 관리 모듈
class ChartManager {
    constructor() {
        this.charts = {};  // 차트 인스턴스 저장
    }

    /**
     * 차트 생성 또는 업데이트
     * @param {string} chartId - 캔버스 ID
     * @param {string} type - Chart.js 타입 (line, bar, pie, etc)
     * @param {object} data - Chart.js data 객체
     * @param {object} options - Chart.js options 객체
     */
    createOrUpdateChart(chartId, type, data, options = {}) {
        // 기존 차트 파괴
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
        }

        // 새 차트 생성
        const ctx = document.getElementById(chartId);
        if (!ctx) {
            console.error(`Canvas element with ID '${chartId}' not found`);
            return null;
        }

        this.charts[chartId] = new Chart(ctx, {
            type: type,
            data: data,
            options: options
        });

        return this.charts[chartId];
    }

    /**
     * 특정 차트 파괴
     */
    destroyChart(chartId) {
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
            delete this.charts[chartId];
        }
    }

    /**
     * 모든 차트 파괴
     */
    destroyAllCharts() {
        Object.keys(this.charts).forEach(chartId => {
            this.charts[chartId].destroy();
        });
        this.charts = {};
    }
}

// 전역 인스턴스
window.chartManager = new ChartManager();

// Dashboard에서 사용 예시
async function loadDashboardStats() {
    try {
        const response = await window.apiClient.get('/dashboard/stats');
        
        if (response.success) {
            const data = response.data;
            
            // 월별 사용량 차트
            window.chartManager.createOrUpdateChart(
                'usageChart',
                'line',
                {
                    labels: data.monthlyUsage.map(m => `${m.month}월`),
                    datasets: [{
                        label: 'API 호출 수',
                        data: data.monthlyUsage.map(m => m.calls),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.3
                    }]
                },
                {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    }
                }
            );

            // 상태 코드 분포 차트
            window.chartManager.createOrUpdateChart(
                'statusChart',
                'doughnut',
                {
                    labels: data.statusCodeDistribution.map(s => `${s.status_code}`),
                    datasets: [{
                        data: data.statusCodeDistribution.map(s => s.count),
                        backgroundColor: ['#10b981', '#ef4444', '#f59e0b']
                    }]
                }
            );
        }
    } catch (error) {
        console.error('통계 로드 실패:', error);
        showErrorMessage('대시보드 통계를 불러올 수 없습니다');
    }
}

// 페이지 이동 또는 컴포넌트 언마운트 시 호출
window.addEventListener('beforeunload', () => {
    window.chartManager.destroyAllCharts();
});

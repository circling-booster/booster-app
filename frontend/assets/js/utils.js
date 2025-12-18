(function (window) {

    class UIUtils {
        // 토스트 메시지 표시
        static showToast(message, type = 'info', duration = UI_CONFIG.DEFAULT_TOAST_DURATION) {
            const toastContainer = document.getElementById('toast-container') || this.createToastContainer();

            const toast = document.createElement('div');
            toast.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
            toast.setAttribute('role', 'alert');
            toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

            toastContainer.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, duration);
        }

        // 토스트 컨테이너 생성
        static createToastContainer() {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            width: 300px;
        `;
            document.body.appendChild(container);
            return container;
        }

        // 로딩 스피너 표시
        static showSpinner(target = 'body') {
            const spinner = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">로딩 중...</span>
            </div>
        `;

            const element = typeof target === 'string' ? document.querySelector(target) : target;
            if (element) {
                element.innerHTML = spinner;
            }
        }

        // 로딩 스피너 숨기기
        static hideSpinner(target = 'body') {
            const element = typeof target === 'string' ? document.querySelector(target) : target;
            if (element) {
                element.innerHTML = '';
            }
        }

        // 모달 표시
        static showModal(title, content, buttons = []) {
            const modal = new bootstrap.Modal(document.getElementById('confirmModal') || this.createModal());
            document.querySelector('.modal-title').textContent = title;
            document.querySelector('.modal-body').innerHTML = content;

            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = buttons.map(btn =>
                `<button type="button" class="btn ${btn.class}" data-bs-dismiss="modal">${btn.text}</button>`
            ).join('');

            modal.show();
        }

        // 모달 생성
        static createModal() {
            const modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'modal fade';
            modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body"></div>
                    <div class="modal-footer"></div>
                </div>
            </div>
        `;
            document.body.appendChild(modal);
            return modal;
        }

        // 테이블 렌더링
        static renderTable(data, columns, tableSelector) {
            const table = document.querySelector(tableSelector);
            if (!table) return;

            const tbody = table.querySelector('tbody');
            tbody.innerHTML = data.map(row => `
            <tr>
                ${columns.map(col => `<td>${this.formatValue(row[col.field], col.format)}</td>`).join('')}
            </tr>
        `).join('');
        }

        // 값 포맷팅
        static formatValue(value, format) {
            if (!format) return value;

            if (format === 'date') {
                return new Date(value).toLocaleDateString('ko-KR');
            } else if (format === 'datetime') {
                return new Date(value).toLocaleString('ko-KR');
            } else if (format === 'number') {
                return Number(value).toLocaleString('ko-KR');
            } else if (format === 'currency') {
                return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
            }

            return value;
        }

        // CSV 다운로드
        static downloadCSV(data, filename = 'data.csv') {
            const headers = Object.keys(data);
            const csv = [
                headers.join(','),
                ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
        }

        // 페이지네이션 렌더링
        static renderPagination(currentPage, totalPages, onPageChange) {
            const pagination = document.querySelector('.pagination');
            if (!pagination) return;

            pagination.innerHTML = '';

            // 이전 버튼
            const prevLi = document.createElement('li');
            prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
            prevLi.innerHTML = `<a class="page-link" href="#">이전</a>`;
            prevLi.addEventListener('click', () => currentPage > 1 && onPageChange(currentPage - 1));
            pagination.appendChild(prevLi);

            // 페이지 번호
            for (let i = 1; i <= totalPages; i++) {
                if (i === currentPage || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    const li = document.createElement('li');
                    li.className = `page-item ${i === currentPage ? 'active' : ''}`;
                    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
                    li.addEventListener('click', () => onPageChange(i));
                    pagination.appendChild(li);
                }
            }

            // 다음 버튼
            const nextLi = document.createElement('li');
            nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
            nextLi.innerHTML = `<a class="page-link" href="#">다음</a>`;
            nextLi.addEventListener('click', () => currentPage < totalPages && onPageChange(currentPage + 1));
            pagination.appendChild(nextLi);
        }

        // 다크모드 토글
        static toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
            localStorage.setItem(STORAGE_KEYS.THEME, isDarkMode ? 'dark' : 'light');
        }

        // 다크모드 초기화
        static initDarkMode() {
            const theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
            }
        }

        // 권한 확인
        static checkPermission(requiredRole) {
            if (requiredRole === 'admin') {
                return authManager.isAdmin();
            }
            return authManager.isLoggedIn();
        }

        // 페이지 접근 제한
        static enforcePermission(requiredRole = 'user') {
            if (!authManager.isLoggedIn()) {
                window.location.href = '/pages/auth/login.html';
                return false;
            }

            if (requiredRole === 'admin' && !authManager.isAdmin()) {
                UIUtils.showToast('관리자 권한이 필요합니다', 'warning');
                window.location.href = '/index.html';
                return false;
            }

            return true;
        }
    }

    // 전역 객체에 할당
    window.UIUtils = UIUtils;
})(window);
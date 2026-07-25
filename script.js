/* ==========================================================
   ATTENDANCE GUARDIAN - HOLIDAY DEFINITIONS & CACHE
   Indian National & Public Holidays (Manual Fallback / Definition)
   ========================================================== */

const FIXED_INDIAN_HOLIDAYS_2026 = {
    "2026-01-26": "Republic Day",
    "2026-03-04": "Holi",
    "2026-03-31": "Id-ul-Fitr",
    "2026-04-03": "Good Friday",
    "2026-04-14": "Dr. B.R. Ambedkar Jayanti",
    "2026-05-01": "May Day / Labour Day",
    "2026-05-27": "Bakrid / Eid al-Adha",
    "2026-06-26": "Muharram",
    "2026-08-15": "Independence Day",
    "2026-08-28": "Milad-un-Nabi",
    "2026-09-04": "Janmashtami",
    "2026-10-02": "Mahatma Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-08": "Diwali (Deepavali)",
    "2026-11-24": "Guru Nanak Jayanti",
    "2026-12-25": "Christmas Day"
};

/**
 * Returns holiday name if date is a holiday, else null.
 * Format expected: YYYY-MM-DD
 */
function getHolidayName(dateString) {
    return FIXED_INDIAN_HOLIDAYS_2026[dateString] || null;
}
/* ==========================================================
   ATTENDANCE GUARDIAN - UTILITIES
   Date helpers, formatting, and calculation algorithms
   ========================================================== */

const SEMESTER_START_DATE = new Date(2026, 5, 29); // 29 June 2026 (Month is 0-indexed: 5 = June)
const TARGET_ATTENDANCE = 75.0;

/**
 * Formats a Date object into YYYY-MM-DD string using local time.
 */
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD into a local Date object.
 */
function parseDateKey(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Checks if a given date is the Second Saturday of its month.
 */
function isSecondSaturday(date) {
    if (date.getDay() !== 6) return false; // Must be Saturday
    const dayNum = date.getDate();
    return dayNum >= 8 && dayNum <= 14;
}

/**
 * Determines if a date is a working day (Not Sunday, Not 2nd Saturday, Not Holiday, Not before semester start).
 */
function isWorkingDay(date, userManualHolidays = {}) {
    // Before semester start check
    if (date < SEMESTER_START_DATE) return false;

    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return false; // Sunday
    if (isSecondSaturday(date)) return false; // Second Saturday

    const dateKey = formatDateKey(date);
    if (getHolidayName(dateKey)) return false; // Default Holiday
    if (userManualHolidays[dateKey] === 'Holiday') return false; // User Manual Sudden Holiday

    return true;
}

/**
 * Formats date into readable string e.g. "Monday, 29 June 2026"
 */
function formatReadableDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}
/* ==========================================================
   ATTENDANCE GUARDIAN - CORE APPLICATION SCRIPT
   State Management, Live Calculations, UI Renderer, Calendar Engine
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let appState = {
        attendance: {}, // { "YYYY-MM-DD": "Present" | "Absent" | "Holiday" }
        settings: {
            target: 75.0
        }
    };

    // Calendar navigation state
    let activeDate = new Date(); // Current viewing month/year
    let selectedDateKey = null;  // Date currently open in modal

    // DOM Elements
    const headerDateEl = document.getElementById('header-date');
    const headerPctEl = document.getElementById('header-pct');
    const headerStatusBadge = document.getElementById('header-status-badge');

    const statCurrentPct = document.getElementById('stat-current-pct');
    const statPresent = document.getElementById('stat-present');
    const statAbsent = document.getElementById('stat-absent');
    const statWorking = document.getElementById('stat-working');

    const smartEngineContent = document.getElementById('smart-engine-content');
    const motivationText = document.getElementById('motivation-text');
    const todaysAdviceText = document.getElementById('todays-advice-text');

    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const todayMonthBtn = document.getElementById('today-month-btn');

    const simPresentPct = document.getElementById('sim-present-pct');
    const simAbsentPct = document.getElementById('sim-absent-pct');

    const attendanceModal = document.getElementById('attendance-modal');
    const modalDateTitle = document.getElementById('modal-date-title');
    const modalDateSubtitle = document.getElementById('modal-date-subtitle');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const attendanceOptionBtns = document.querySelectorAll('.attendance-option-btn');

    // Initialization
    initApp();

    function initApp() {
        loadLocalStorage();
        setupEventListeners();
        render();
    }

    function loadLocalStorage() {
        const storedData = localStorage.getItem('attendance_guardian_state');
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                if (parsed && parsed.attendance) {
                    appState.attendance = parsed.attendance;
                }
            } catch (e) {
                console.error('Failed to parse local storage', e);
            }
        }
    }

    function saveLocalStorage() {
        localStorage.setItem('attendance_guardian_state', JSON.stringify(appState));
    }

    function setupEventListeners() {
        prevMonthBtn.addEventListener('click', () => {
            activeDate.setMonth(activeDate.getMonth() - 1);
            renderCalendar();
        });

        nextMonthBtn.addEventListener('click', () => {
            activeDate.setMonth(activeDate.getMonth() + 1);
            renderCalendar();
        });

        todayMonthBtn.addEventListener('click', () => {
            activeDate = new Date();
            renderCalendar();
        });

        modalCancelBtn.addEventListener('click', closeModal);
        attendanceModal.addEventListener('click', (e) => {
            if (e.target === attendanceModal) closeModal();
        });

        attendanceOptionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const status = btn.getAttribute('data-status');
                if (selectedDateKey && status) {
                    recordAttendance(selectedDateKey, status);
                    closeModal();
                    render();
                }
            });
        });
    }

    function recordAttendance(dateKey, status) {
        const dateObj = parseDateKey(dateKey);

        // Error prevention rules
        if (dateObj > new Date()) return; // Future date lock
        if (dateObj < SEMESTER_START_DATE) return; // Before semester start

        // If it's a regular Sunday or 2nd Saturday, we don't need manual holiday marking unless desired,
        // but for normal working days, allow marking sudden holidays.
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0 || isSecondSaturday(dateObj)) {
            if (status === 'Holiday') return; // Weekend is already off
        }

        appState.attendance[dateKey] = status;
        saveLocalStorage();
    }

    function openModal(dateKey) {
        const dateObj = parseDateKey(dateKey);
        const today = new Date();
        today.setHours(0,0,0,0);

        // Rules check for opening modal
        if (dateObj > today) return; // Future locked
        if (dateObj < SEMESTER_START_DATE) return; // Pre-semester locked
        
        // Allow opening modal on weekends/holidays too in case user wants to clear or toggle, 
        // but primarily standard working days. Let's allow valid dates >= SEMESTER_START_DATE and <= today.
        selectedDateKey = dateKey;
        modalDateTitle.textContent = appState.attendance[dateKey] ? 'Edit Attendance/Status' : 'Mark Attendance/Status';
        modalDateSubtitle.textContent = formatReadableDate(dateObj);
        
        attendanceModal.classList.remove('hidden');
    }

    function closeModal() {
        attendanceModal.classList.add('hidden');
        selectedDateKey = null;
    }

    /**
     * Core Calculations Engine
     */
    function calculateMetrics() {
        let presentDays = 0;
        let absentDays = 0;
        let completedWorkingDays = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        Object.keys(appState.attendance).forEach(dateKey => {
            const dateObj = parseDateKey(dateKey);
            if (dateObj <= today && dateObj >= SEMESTER_START_DATE) {
                const status = appState.attendance[dateKey];
                // Check if it's considered a working day considering manual holidays
                const isWorking = isWorkingDay(dateObj, appState.attendance);

                if (isWorking) {
                    if (status === 'Present') {
                        presentDays++;
                        completedWorkingDays++;
                    } else if (status === 'Absent') {
                        absentDays++;
                        completedWorkingDays++;
                    }
                }
            }
        });

        const currentPct = completedWorkingDays > 0 ? (presentDays / completedWorkingDays) * 100 : 0.0;

        return {
            presentDays,
            absentDays,
            completedWorkingDays,
            currentPct
        };
    }

    function render() {
        const metrics = calculateMetrics();
        const todayObj = new Date();
        
        // Header updates
        headerDateEl.textContent = formatReadableDate(todayObj);
        headerPctEl.textContent = `${metrics.currentPct.toFixed(2)}%`;
        
        const statusMeta = getStatusAndMotivation(metrics.currentPct);
        headerStatusBadge.textContent = statusMeta.statusText;
        headerStatusBadge.className = `status-badge font-mono ${statusMeta.badgeClass}`;

        // Dashboard stats updates
        statCurrentPct.textContent = `${metrics.currentPct.toFixed(2)}%`;
        statPresent.textContent = metrics.presentDays;
        statAbsent.textContent = metrics.absentDays;
        statWorking.textContent = metrics.completedWorkingDays;

        // Smart Attendance Engine rendering
        renderSmartEngine(metrics);

        // Motivational & Advice text
        motivationText.textContent = statusMeta.motivation;
        todaysAdviceText.textContent = getTodaysAdvice(metrics);

        // Simulations
        renderSimulations(metrics);

        // Render Calendar Grid
        renderCalendar();
    }

    function getStatusAndMotivation(pct) {
        if (pct >= 90) {
            return {
                statusText: 'Excellent',
                badgeClass: 'badge-excellent',
                motivation: 'Outstanding consistency. Keep leading by example.'
            };
        } else if (pct >= 80) {
            return {
                statusText: 'Great',
                badgeClass: 'badge-great',
                motivation: "You're doing great. Stay disciplined and maintain momentum."
            };
        } else if (pct >= 75) {
            return {
                statusText: 'Safe',
                badgeClass: 'badge-safe',
                motivation: "You're above the 75% requirement. Stay focused."
            };
        } else if (pct >= 70) {
            return {
                statusText: 'Warning',
                badgeClass: 'badge-warning',
                motivation: 'One more absence could become costly. Guard your classes.'
            };
        } else {
            return {
                statusText: 'Critical',
                badgeClass: 'badge-critical',
                motivation: 'Every attendance matters now. Do not miss another working day.'
            };
        }
    }

    function renderSmartEngine(metrics) {
        const { presentDays, completedWorkingDays, currentPct } = metrics;
        
        if (completedWorkingDays === 0) {
            smartEngineContent.innerHTML = `
                <div class="engine-highlight-box">
                    <span class="engine-main-text font-mono">No Working Days Recorded Yet</span>
                    <span class="engine-sub-text">Begin marking your attendance on the calendar to activate the Smart Engine.</span>
                </div>
            `;
            return;
        }

        if (currentPct >= TARGET_ATTENDANCE) {
            let maxCanMiss = Math.floor((presentDays - (TARGET_ATTENDANCE / 100) * completedWorkingDays) / (TARGET_ATTENDANCE / 100));
            if (maxCanMiss < 0) maxCanMiss = 0;

            smartEngineContent.innerHTML = `
                <div class="engine-highlight-box">
                    <span class="engine-main-text">Safe & Compliant</span>
                    <span class="engine-sub-text">You may still safely miss <strong>${maxCanMiss}</strong> working days before dropping below the strict 75% threshold.</span>
                </div>
            `;
        } else {
            let needed = Math.ceil(((TARGET_ATTENDANCE / 100) * completedWorkingDays - presentDays) / (1 - (TARGET_ATTENDANCE / 100)));
            if (needed < 0) needed = 0;

            smartEngineContent.innerHTML = `
                <div class="engine-highlight-box critical-border">
                    <span class="engine-main-text">Critical Attendance Deficit</span>
                    <span class="engine-sub-text">You need <strong>${needed}</strong> consecutive Present working days to climb back to 75%. Bunking is strictly prohibited.</span>
                </div>
            `;
        }
    }

    function getTodaysAdvice(metrics) {
        const { presentDays, completedWorkingDays } = metrics;
        if (completedWorkingDays === 0) return 'Mark today and past days to receive real-time predictive advice.';

        const pctIfPresent = ((presentDays + 1) / (completedWorkingDays + 1)) * 100;
        const pctIfAbsent = (presentDays / (completedWorkingDays + 1)) * 100;

        if (metrics.currentPct >= TARGET_ATTENDANCE) {
            if (pctIfAbsent >= TARGET_ATTENDANCE) {
                return `You are currently at ${metrics.currentPct.toFixed(2)}%. You may safely miss today and still remain above 75% (${pctIfAbsent.toFixed(2)}%).`;
            } else {
                return `Caution: Missing today will drop your attendance to ${pctIfAbsent.toFixed(2)}%, which breaches the 75% benchmark.`;
            }
        } else {
            return `Attendance is below target. Attending today will raise your percentage to ${pctIfPresent.toFixed(2)}%.`;
        }
    }

    function renderSimulations(metrics) {
        const { presentDays, completedWorkingDays } = metrics;
        const simPresent = ((presentDays + 1) / (completedWorkingDays + 1)) * 100;
        const simAbsent = (presentDays / (completedWorkingDays + 1)) * 100;

        simPresentPct.textContent = `${simPresent.toFixed(2)}%`;
        simAbsentPct.textContent = `${simAbsent.toFixed(2)}%`;
    }

    function renderCalendar() {
        const year = activeDate.getFullYear();
        const month = activeDate.getMonth();

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        calendarMonthYear.textContent = `${monthNames[month]} ${year}`;

        calendarGrid.innerHTML = '';

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        const today = new Date();
        today.setHours(0,0,0,0);

        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cal-day empty';
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            dateObj.setHours(0,0,0,0);
            const dateKey = formatDateKey(dateObj);

            const dayCell = document.createElement('div');
            dayCell.className = 'cal-day';
            dayCell.textContent = day;

            const isToday = dateObj.getTime() === today.getTime();
            const isFuture = dateObj > today;
            const isPreSemester = dateObj < SEMESTER_START_DATE;
            const isSun = dateObj.getDay() === 0;
            const is2ndSat = isSecondSaturday(dateObj);
            const defaultHolidayName = getHolidayName(dateKey);
            const attendanceStatus = appState.attendance[dateKey];

            if (isPreSemester) {
                dayCell.classList.add('status-pre-semester');
            } else if (isFuture) {
                dayCell.classList.add('status-future');
            } else if (isSun || is2ndSat) {
                dayCell.classList.add('status-off');
            } else if (defaultHolidayName || attendanceStatus === 'Holiday') {
                dayCell.classList.add('status-holiday');
                dayCell.title = defaultHolidayName ? `Holiday: ${defaultHolidayName}` : 'Sudden College Holiday';
            } else if (attendanceStatus === 'Present') {
                dayCell.classList.add('status-present');
                dayCell.title = 'Present';
            } else if (attendanceStatus === 'Absent') {
                dayCell.classList.add('status-absent');
                dayCell.title = 'Absent';
            } else {
                dayCell.classList.add('status-unmarked');
            }

            if (isToday) {
                dayCell.classList.add('status-today');
            }

            if (!isFuture && !isPreSemester) {
                dayCell.addEventListener('click', () => {
                    openModal(dateKey);
                });
            }

            calendarGrid.appendChild(dayCell);
        }
    }
});
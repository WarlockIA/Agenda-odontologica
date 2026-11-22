// reportes.js — Reportes y Gráficas Contables del Dashboard Financiero
import { dom } from './dom.js';
import { api } from './api.js';
import { showToast } from './ui.js';
import { escapeHtml, formatCurrency } from './utils.js';

let monthlyIncomeChartInstance = null;
let appointmentStatusChartInstance = null;
let categoriesChartInstance = null;
let treatmentsChartInstance = null;
let lastTreatmentsData = null;
let currentMetric = 'frecuencia';

let currentReportPeriod = 'este_mes';
let customStartDate = '';
let customEndDate = '';

const chartBaseColors = [
  '#0ea5e9', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#ef4444', // Red
  '#6366f1'  // Indigo
];

// Plugin personalizado para mostrar texto en el centro de las donas
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw: function (chart) {
    if (chart.config.options.elements && chart.config.options.elements.center) {
      const ctx = chart.ctx;
      const centerConfig = chart.config.options.elements.center;
      const text = centerConfig.text;
      const color = centerConfig.color || '#ffffff';

      ctx.save();
      ctx.font = "bold 28px Outfit, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = 'center';

      const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
      let centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

      // Ajuste para semi-donas (Half Doughnut)
      if (chart.config.options.circumference === 180) {
        ctx.textBaseline = 'bottom';
        centerY = chart.chartArea.bottom - 10;

        ctx.fillText(text, centerX, centerY - (centerConfig.subText ? 20 : 0));

        if (centerConfig.subText) {
          ctx.font = "500 14px Outfit, sans-serif";
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(centerConfig.subText, centerX, centerY + 2);
        }
      } else {
        ctx.textBaseline = 'middle';
        ctx.fillText(text, centerX, centerY - (centerConfig.subText ? 10 : 0));

        if (centerConfig.subText) {
          ctx.font = "500 13px Outfit, sans-serif";
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(centerConfig.subText, centerX, centerY + 18);
        }
      }
      ctx.restore();
    }
  }
};

export async function loadFinancialReports() {
  try {
    const res = await api.getFinancialReports(currentReportPeriod, customStartDate, customEndDate);
    if (!res.ok) {
      if (res.status === 403) {
        showToast('No tiene permisos para ver este reporte.', 'error');
      } else {
        showToast('Error al cargar los reportes financieros.', 'error');
      }
      return;
    }
    const data = await res.json();

    // 1. Renderizar KPIs
    if (dom.reportsTotalIncome) dom.reportsTotalIncome.textContent = `${formatCurrency(data.kpis.totalIngresos)} Bs.`;
    if (dom.reportsTotalBilled) dom.reportsTotalBilled.textContent = `${formatCurrency(data.kpis.totalFacturado)} Bs.`;
    if (dom.reportsTotalDebt) dom.reportsTotalDebt.textContent = `${formatCurrency(data.kpis.totalDeuda)} Bs.`;
    if (dom.reportsAgendaEfficiency) dom.reportsAgendaEfficiency.textContent = `${data.kpis.eficienciaAgenda}%`;
    if (dom.reportsAbsenteeismRate) dom.reportsAbsenteeismRate.textContent = `${data.kpis.tasaAusentismo}%`;

    // 2. Renderizar ranking de deudores
    renderDebtorsTable(data.pacientesDeudores);

    // Renderizar gráfico de categorías de tratamiento
    renderCategoriesChart(data.ingresosPorCategoria);

    // Renderizar gráfico de estados de citas
    renderAppointmentStatusChart(data.citasProporciones);

    // Renderizar tratamientos más comunes
    renderTreatmentsTable(data.tratamientosMasComunes);

    // 3. Renderizar Gráfico Mensual
    renderMonthlyIncomeChart(data.ingresosMensuales);

  } catch (err) {
    console.error('Error al cargar reportes financieros:', err);
    showToast('Error de conexión con el servidor.', 'error');
  }
}

function renderDebtorsTable(debtors) {
  if (!dom.reportsDebtorsTableBody) return;

  if (!debtors || debtors.length === 0) {
    dom.reportsDebtorsTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px; font-style: italic;">No hay pacientes con deuda pendiente.</td>
      </tr>
    `;
    return;
  }

  dom.reportsDebtorsTableBody.innerHTML = debtors.map(pat => `
    <tr>
      <td style="font-weight: 600; white-space: nowrap;">${escapeHtml(pat.nombre_completo)}</td>
      <td style="white-space: nowrap;">${escapeHtml(pat.ci)}</td>
      <td style="white-space: nowrap;">${pat.telefono ? escapeHtml(pat.telefono) : '<span style="color:var(--text-muted);">Sin teléfono</span>'}</td>
      <td style="white-space: nowrap; color: var(--text-muted);">${pat.ultima_atencion ? escapeHtml(pat.ultima_atencion) : '—'}</td>
      <td style="text-align: right; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">${formatCurrency(pat.total_facturado || 0)} Bs.</td>
      <td style="text-align: right; font-weight: 700; color: var(--danger); white-space: nowrap;">
        <span style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
          ${formatCurrency(pat.saldo_deuda)} Bs.
        </span>
      </td>
    </tr>
  `).join('');
}

function renderTreatmentsTable(treatments) {
  if (!dom.reportsTreatmentsTableBody) return;

  const totalCountEl = document.getElementById('reports-treat-total-count');
  const totalRevEl   = document.getElementById('reports-treat-total-revenue');

  if (!treatments || treatments.length === 0) {
    dom.reportsTreatmentsTableBody.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:40px 20px; font-style:italic; font-size:14px;">
        No hay tratamientos registrados en este período.
      </div>
    `;
    if (totalCountEl) totalCountEl.textContent = '0';
    if (totalRevEl)   totalRevEl.textContent   = '0,00';
    return;
  }

  const totalCantidad  = treatments.reduce((s, t) => s + t.cantidad, 0);
  const totalRecaudado = treatments.reduce((s, t) => s + t.total_recaudado, 0);
  const maxCantidad    = Math.max(...treatments.map(t => t.cantidad));

  if (totalCountEl) totalCountEl.textContent = totalCantidad;
  if (totalRevEl)   totalRevEl.textContent   = formatCurrency(totalRecaudado);

  const rankEmoji = ['🥇', '🥈', '🥉'];

  dom.reportsTreatmentsTableBody.innerHTML = treatments.map((treat, idx) => {
    // Mismo color que el segmento correspondiente en el gráfico de dona
    const color  = chartBaseColors[idx % chartBaseColors.length];

    const colorD9 = color + 'D9'; // 85% opacidad — brillante (stop 0 del gradiente)
    const color1A = color + '1A'; // 10% opacidad — suave   (stop 1 del gradiente)
    const color33 = color + '33'; // 20% opacidad — glow hover

    const pct   = totalCantidad > 0 ? Math.round((treat.cantidad / totalCantidad) * 100) : 0;
    const barW  = maxCantidad  > 0 ? Math.round((treat.cantidad / maxCantidad) * 100) : 0;
    const delay = (idx * 0.07).toFixed(2);
    const isTop3 = idx < 3;

    // Métrica de impacto financiero
    const revenueShare = totalRecaudado > 0 ? ((treat.total_recaudado / totalRecaudado) * 100).toFixed(1) : '0.0';

    return `
      <div class="treatment-rank-card-item" style="
        --item-color: ${color};
        --item-color-d9: ${colorD9};
        --item-color-1a: ${color1A};
        --item-color-33: ${color33};
        animation-delay: ${delay}s;
      ">
        <!-- Badge ranking -->
        <div class="treatment-rank-badge" style="
          background: linear-gradient(135deg, ${colorD9} 0%, ${color1A} 100%);
          font-size: ${isTop3 ? '20px' : '13px'};
          box-shadow: 0 4px 14px ${color33};
        ">${isTop3 ? rankEmoji[idx] : '#' + (idx + 1)}</div>

        <!-- Nombre + Barra Animada -->
        <div style="min-width: 0;">
          <div style="
            font-weight: 600; color: var(--text-primary);
            font-size: 14.5px; line-height: 1.3; margin-bottom: 8px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          " title="${escapeHtml(treat.nombre)}">${escapeHtml(treat.nombre)}</div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="treatment-rank-bar-bg" style="flex: 1; position: relative; height: 6.5px; border-radius: 4px; overflow: hidden;">
              <div style="
                position: absolute; left: 0; top: 0; height: 100%;
                width: ${barW}%;
                background: linear-gradient(90deg, ${color1A}, ${colorD9});
                border-radius: 4px;
                animation: barSlide 1s cubic-bezier(0.34, 1.56, 0.64, 1) ${(parseFloat(delay) + 0.2).toFixed(2)}s backwards;
              "></div>
            </div>
            <span style="font-size: 11px; font-weight: 700; color: ${colorD9}; white-space: nowrap; letter-spacing: 0.02em;">${pct}%</span>
          </div>
        </div>

        <!-- Cantidad -->
        <div style="text-align: center; flex-shrink: 0; min-width: 80px;">
          <div style="font-size: 20px; font-weight: 800; color: ${colorD9}; line-height: 1;">${treat.cantidad}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px; letter-spacing: 0.04em; text-transform: uppercase;">procedimientos</div>
        </div>

        <!-- Recaudado -->
        <div style="text-align: right; flex-shrink: 0; min-width: 110px;">
          <div style="font-size: 16px; font-weight: 800; color: ${colorD9}; white-space: nowrap;">${formatCurrency(treat.total_recaudado)} Bs.</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px; letter-spacing: 0.04em; text-transform: uppercase;">recaudado</div>
          <div style="font-size: 10px; font-weight: 600; color: ${colorD9}; margin-top: 2px;">${revenueShare}% del ingreso</div>
        </div>
      </div>
    `;
  }).join('');
}









function renderCategoriesChart(categoryData) {
  const ctx = dom.chartCategoriesCanvas?.getContext('2d');
  if (!ctx) return;

  const Chart = window.Chart;
  if (!Chart) return;

  if (categoriesChartInstance) {
    categoriesChartInstance.destroy();
  }

  const labels = [];
  const dataValues = [];

  if (categoryData && categoryData.length > 0) {
    categoryData.forEach(item => {
      labels.push(item.categoria);
      dataValues.push(item.ingresos || 0);
    });
  }

  const hasData = dataValues.some(val => val > 0);
  const dataSet = hasData ? dataValues : [1];
  const labelsSet = hasData ? labels : ['Sin datos'];
  const totalIngresos = hasData ? dataValues.reduce((a, b) => a + b, 0) : 0;

  const createGradient = (ctx, baseColorHex) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, baseColorHex + 'D9');
    gradient.addColorStop(1, baseColorHex + '1A');
    return gradient;
  };

  const colors = hasData
    ? labels.map((_, idx) => createGradient(ctx, chartBaseColors[idx % chartBaseColors.length]))
    : ['rgba(148, 163, 184, 0.15)'];

  categoriesChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labelsSet,
      datasets: [
        {
          data: dataSet,
          backgroundColor: colors,
          borderColor: '#0f172a',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      layout: { padding: 15 },
      elements: {
        center: {
          text: formatCurrency(totalIngresos) + ' Bs.',
          subText: 'Ingresos',
          color: '#ffffff'
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            boxWidth: 12,
            padding: 14,
            font: { family: 'Outfit, var(--font-sans)', size: 11.5 }
          }
        },
        tooltip: {
          padding: 10,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          titleFont: { weight: 'bold', family: 'Outfit' },
          bodyColor: '#e2e8f0',
          bodyFont: { family: 'Outfit' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.raw ? `${formatCurrency(context.raw)} Bs.` : '0 Bs.';
              return ` ${label}: ${value}`;
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}

function renderAppointmentStatusChart(proportions) {
  const ctx = dom.chartAppointmentStatusCanvas?.getContext('2d');
  if (!ctx) return;

  const Chart = window.Chart;
  if (!Chart) {
    console.error('Chart.js no está cargado.');
    return;
  }

  if (appointmentStatusChartInstance) {
    appointmentStatusChartInstance.destroy();
  }

  const { programadas, enEspera, atendidas, ausentes, canceladas } = proportions || {};
  const dataValues = [programadas || 0, enEspera || 0, atendidas || 0, ausentes || 0, canceladas || 0];

  const hasData = dataValues.some(val => val > 0);
  const dataSet = hasData ? dataValues : [0, 0, 0, 0, 0];
  const totalAppointments = dataSet.reduce((a, b) => a + b, 0);

  // Helper para crear gradientes que se desvanezcan a transparente (como las barras)
  const createGradient = (ctx, baseColorHex) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, baseColorHex + 'D9'); // 85% opacidad
    gradient.addColorStop(1, baseColorHex + '1A'); // 10% opacidad
    return gradient;
  };

  const gradientsStatus = [
    createGradient(ctx, '#0ea5e9'), // Programada (Blue)
    createGradient(ctx, '#f59e0b'), // En Espera (Amber)
    createGradient(ctx, '#10b981'), // Atendida (Emerald)
    createGradient(ctx, '#ef4444'), // Ausente (Red)
    createGradient(ctx, '#64748b')  // Cancelada (Slate)
  ];

  appointmentStatusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Programada', 'En Espera', 'Atendida', 'Ausente', 'Cancelada'],
      datasets: [
        {
          data: dataSet,
          backgroundColor: gradientsStatus,
          borderColor: '#0f172a',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      layout: {
        padding: 15
      },
      elements: {
        center: {
          text: totalAppointments.toString(),
          subText: 'Citas',
          color: '#ffffff'
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            boxWidth: 12,
            padding: 16,
            font: { family: 'Outfit, var(--font-sans)', size: 11.5 }
          }
        },
        tooltip: {
          padding: 10,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          titleFont: { weight: 'bold', family: 'Outfit' },
          bodyColor: '#e2e8f0',
          bodyFont: { family: 'Outfit' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          callbacks: {
            title: () => null, // Ocultar título por defecto para evitar textos cortados
            label: function (context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const words = label.split(' ');
              let lines = [];
              let currentLine = '';
              words.forEach(word => {
                if ((currentLine + word).length > 30) { // Reducido a 30 para más seguridad
                  lines.push(currentLine.trim());
                  currentLine = word + ' ';
                } else {
                  currentLine += word + ' ';
                }
              });
              if (currentLine) lines.push(currentLine.trim());
              lines[0] = ` ${lines[0]}`;
              lines.push(` Total: ${value} citas`);
              return lines;
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}

function renderMonthlyIncomeChart(monthlyData) {
  const ctx = dom.chartMonthlyIncomeCanvas?.getContext('2d');
  if (!ctx) return;

  const Chart = window.Chart;
  if (!Chart) {
    console.error('Chart.js no está cargado en window.');
    return;
  }

  if (monthlyIncomeChartInstance) {
    monthlyIncomeChartInstance.destroy();
  }

  const labels = [];
  const ingresos = [];
  const facturado = [];

  if (monthlyData && monthlyData.length > 0) {
    monthlyData.forEach(row => {
      const [year, month] = row.mes.split('-');
      const date = new Date(year, parseInt(month) - 1, 1);
      const mesStr = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      labels.push(mesStr.charAt(0).toUpperCase() + mesStr.slice(1));
      ingresos.push(row.ingresos);
      facturado.push(row.facturado);
    });
  } else {
    labels.push('Sin datos');
    ingresos.push(0);
    facturado.push(0);
  }

  // Gradientes dinámicos individuales por cada barra (element.y a element.base) 100% SÓLIDOS y SEGUROS
  const getPerBarGreenGradient = (context) => {
    const { ctx, chart, element } = context;
    if (!ctx) return '#059669';
    const chartArea = chart?.chartArea;
    const yTop = (element && Number.isFinite(element.y)) ? element.y : (chartArea ? chartArea.top : 0);
    const yBase = (element && Number.isFinite(element.base)) ? element.base : (chartArea ? chartArea.bottom : 300);

    if (!Number.isFinite(yTop) || !Number.isFinite(yBase) || Math.abs(yBase - yTop) < 2) {
      return '#059669';
    }

    try {
      const gradient = ctx.createLinearGradient(0, yTop, 0, yBase);
      gradient.addColorStop(0, '#10b981');   // Verde Esmeralda vívido arriba
      gradient.addColorStop(0.45, '#059669'); // Verde Esmeralda medio
      gradient.addColorStop(1, '#044e39');   // Verde Bosque opaco en la base
      return gradient;
    } catch (e) {
      return '#059669';
    }
  };

  const getPerBarBlueGradient = (context) => {
    const { ctx, chart, element } = context;
    if (!ctx) return '#0284c7';
    const chartArea = chart?.chartArea;
    const yTop = (element && Number.isFinite(element.y)) ? element.y : (chartArea ? chartArea.top : 0);
    const yBase = (element && Number.isFinite(element.base)) ? element.base : (chartArea ? chartArea.bottom : 300);

    if (!Number.isFinite(yTop) || !Number.isFinite(yBase) || Math.abs(yBase - yTop) < 2) {
      return '#0284c7';
    }

    try {
      const gradient = ctx.createLinearGradient(0, yTop, 0, yBase);
      gradient.addColorStop(0, '#0ea5e9');   // Azul Sky vívido arriba
      gradient.addColorStop(0.45, '#0284c7'); // Azul Cobalto medio
      gradient.addColorStop(1, '#083344');   // Azul Noche opaco en la base
      return gradient;
    } catch (e) {
      return '#0284c7';
    }
  };

  monthlyIncomeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ingresos (Cobrado)',
          data: ingresos,
          backgroundColor: getPerBarGreenGradient,
          hoverBackgroundColor: getPerBarGreenGradient,
          borderColor: '#0f172a',
          hoverBorderColor: '#0f172a',
          borderWidth: 1.5,
          hoverBorderWidth: 1.5,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.65
        },
        {
          label: 'Facturado (Tratamientos)',
          data: facturado,
          backgroundColor: getPerBarBlueGradient,
          hoverBackgroundColor: getPerBarBlueGradient,
          borderColor: '#0f172a',
          hoverBorderColor: '#0f172a',
          borderWidth: 1.5,
          hoverBorderWidth: 1.5,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.65
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1100,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: {
              family: 'Outfit, var(--font-sans)',
              size: 12
            }
          }
        },
        tooltip: {
          padding: 12,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          titleFont: { weight: 'bold', family: 'Outfit' },
          bodyColor: '#e2e8f0',
          bodyFont: { family: 'Outfit' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          callbacks: {
            label: function (context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.raw)} Bs.`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            borderDash: [5, 5]
          },
          ticks: {
            color: '#94a3b8',
            font: {
              family: 'Outfit'
            }
          }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 1000,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            borderDash: [5, 5]
          },
          ticks: {
            precision: 0,
            color: '#94a3b8',
            font: {
              family: 'Outfit'
            },
            callback: function (value) {
              if (Math.floor(value) !== value) return '';
              return value + ' Bs.';
            }
          }
        }
      }
    }
  });
}

function renderTreatmentsChart(treatments, metric = 'frecuencia') {
  const ctx = dom.chartTreatmentsCanvas?.getContext('2d');
  if (!ctx) return;

  const Chart = window.Chart;
  if (!Chart) {
    console.error('Chart.js no está cargado.');
    return;
  }

  if (treatmentsChartInstance) {
    treatmentsChartInstance.destroy();
  }

  if (!treatments || treatments.length === 0) {
    // Si no hay datos, mostrar una dona vacía gris
    treatmentsChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sin datos'],
        datasets: [{
          data: [1],
          backgroundColor: ['rgba(148, 163, 184, 0.15)'],
          borderColor: ['rgba(148, 163, 184, 0.3)'],
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { display: false }
        }
      }
    });
    return;
  }

  const labels = treatments.map(t => t.nombre);
  const data = treatments.map(t => metric === 'frecuencia' ? t.cantidad : t.total_recaudado);

  // Paleta de colores premium curada para un look serio y médico (azules, esmeraldas, índigos)
  const premiumPalette = [
    '#0284c7', '#0d9488', '#2563eb', '#4f46e5',
    '#0891b2', '#059669', '#475569', '#3b82f6'
  ];
  const solidColors = treatments.map((_, idx) => premiumPalette[idx % premiumPalette.length]);

  const totalTratamientos = data.reduce((a, b) => a + b, 0);

  // Helper para crear gradientes que se desvanezcan a transparente
  const createGradient = (ctx, baseColorHex) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, baseColorHex + 'D9'); // 85% opacidad
    gradient.addColorStop(1, baseColorHex + '1A'); // 10% opacidad
    return gradient;
  };

  const gradientColors = treatments.map((_, idx) => {
    const baseColorHex = chartBaseColors[idx % chartBaseColors.length];
    return createGradient(ctx, baseColorHex);
  });

  treatmentsChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: gradientColors,
          borderColor: '#0f172a',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      layout: {
        padding: 15
      },
      elements: {
        center: {
          text: metric === 'frecuencia' ? totalTratamientos.toString() : formatCurrency(totalTratamientos),
          subText: metric === 'frecuencia' ? 'Tratamientos' : 'Bs.',
          color: '#ffffff'
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          padding: 12,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          titleFont: { weight: 'bold', family: 'Outfit' },
          bodyColor: '#e2e8f0',
          bodyFont: { family: 'Outfit' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          callbacks: {
            title: () => null, // Ocultar título por defecto para evitar textos cortados
            label: function (context) {
              const label = context.label || '';
              const value = metric === 'frecuencia' ? context.raw : `${formatCurrency(context.raw)} Bs.`;

              const words = label.split(' ');
              let lines = [];
              let currentLine = '';
              words.forEach(word => {
                if ((currentLine + word).length > 30) { // Reducido a 30
                  lines.push(currentLine.trim());
                  currentLine = word + ' ';
                } else {
                  currentLine += word + ' ';
                }
              });
              if (currentLine) lines.push(currentLine.trim());
              lines[0] = ` ${lines[0]}`;
              lines.push(` Cantidad/Total: ${value}`);
              return lines;
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}

let handlersInitialized = false;

export function setupReportsHandlers() {
  if (handlersInitialized) return;
  handlersInitialized = true;

  const dropdownBtn = document.getElementById('reports-dropdown-btn');
  const dropdownMenu = document.getElementById('reports-dropdown-menu');
  const options = document.querySelectorAll('.custom-date-option');
  const customRangeBox = document.getElementById('reports-custom-range-box');
  const applyCustomBtn = document.getElementById('reports-apply-custom-btn');
  const startDateInput = document.getElementById('reports-start-date');
  const endDateInput = document.getElementById('reports-end-date');

  if (dropdownBtn) {
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('show');
      }
    });

    options.forEach(option => {
      option.addEventListener('click', () => {
        options.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        
        const period = option.dataset.period;
        
        if (period === 'custom') {
          customRangeBox.classList.add('show');
        } else {
          customRangeBox.classList.remove('show');
          dropdownMenu.classList.remove('show');
          dropdownBtn.querySelector('span').textContent = `📅 Filtro: ${option.textContent.replace('...', '')}`;
          
          currentReportPeriod = period;
          customStartDate = '';
          customEndDate = '';
          loadFinancialReports();
        }
      });
    });

    if (applyCustomBtn) {
      applyCustomBtn.addEventListener('click', () => {
        const start = startDateInput.value;
        const end = endDateInput.value;
        
        if (!start || !end) {
          showToast('Por favor, selecciona fecha de inicio y fin.', 'warning');
          return;
        }
        
        if (start > end) {
          showToast('La fecha de inicio no puede ser mayor a la fecha final.', 'warning');
          return;
        }
        
        dropdownMenu.classList.remove('show');
        dropdownBtn.querySelector('span').textContent = `📅 Personalizado`;
        currentReportPeriod = 'custom';
        customStartDate = start;
        customEndDate = end;
        loadFinancialReports();
      });
    }
  }

  dom.btnTreatmentsMetricFreq?.addEventListener('click', () => {
    if (currentMetric === 'frecuencia') return;
    currentMetric = 'frecuencia';
    dom.btnTreatmentsMetricFreq.classList.add('active');
    dom.btnTreatmentsMetricRevenue?.classList.remove('active');
    if (lastTreatmentsData) {
      renderTreatmentsChart(lastTreatmentsData, currentMetric);
    }
  });

  dom.btnTreatmentsMetricRevenue?.addEventListener('click', () => {
    if (currentMetric === 'ingresos') return;
    currentMetric = 'ingresos';
    dom.btnTreatmentsMetricRevenue.classList.add('active');
    dom.btnTreatmentsMetricFreq?.classList.remove('active');
    if (lastTreatmentsData) {
      renderTreatmentsChart(lastTreatmentsData, currentMetric);
    }
  });
}

function hexToRgba(hex, alpha) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(59,130,246,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}

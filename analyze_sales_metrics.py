#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Análisis de métricas de ventas para determinar la mejor metodología
de cálculo de promedios y tiempos estimados de venta.
"""

import re
import sys
import io
from bs4 import BeautifulSoup
import statistics
from typing import Dict, List, Tuple
from dataclasses import dataclass
from collections import defaultdict

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

@dataclass
class ProductMetrics:
    """Datos de un producto del pedido"""
    code: str
    description: str
    quantity: float
    stock: float
    min_stock: float
    price: float
    has_trend: bool
    last_sale_date: str
    
    # Promedios de ventas
    prom_simple: float
    prom_3m: float
    prom_6m: float
    wma: float
    ema: float
    wma_6m: float
    mediana: float
    
    # Tiempos estimados
    test_simple: str
    test_3m: str
    test_6m: str
    test_wma: str
    test_ema: str
    test_wma_6m: str
    test_mediana: str


def parse_html(filepath: str) -> List[ProductMetrics]:
    """Parse el HTML y extrae los datos de cada producto"""
    with open(filepath, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    products = []
    rows = soup.find('tbody').find_all('tr')
    
    for row in rows:
        cells = row.find_all('td')
        
        # Extraer texto limpio
        def get_text(idx):
            return cells[idx].get_text(strip=True)
        
        def parse_number(text):
            """Extrae número de un texto, maneja casos especiales"""
            text = text.replace('$', '').replace(',', '').strip()
            if text == '∞ Infinito' or text == 'Sin datos' or text == '-':
                return float('inf')
            try:
                return float(text)
            except:
                return 0.0
        
        # Determinar si tiene gráfico de tendencia
        has_trend = 'Sin datos' not in cells[5].get_text()
        
        product = ProductMetrics(
            code=get_text(0),
            description=get_text(1),
            quantity=parse_number(get_text(2)),
            stock=parse_number(get_text(3)),
            min_stock=parse_number(get_text(4)),
            price=parse_number(get_text(6)),
            has_trend=has_trend,
            last_sale_date=get_text(21),
            
            # Promedios (índices 7-13)
            prom_simple=parse_number(get_text(7)),
            prom_3m=parse_number(get_text(8)),
            prom_6m=parse_number(get_text(9)),
            wma=parse_number(get_text(10)),
            ema=parse_number(get_text(11)),
            wma_6m=parse_number(get_text(12)),
            mediana=parse_number(get_text(13)),
            
            # Tiempos estimados (índices 14-20)
            test_simple=get_text(14),
            test_3m=get_text(15),
            test_6m=get_text(16),
            test_wma=get_text(17),
            test_ema=get_text(18),
            test_wma_6m=get_text(19),
            test_mediana=get_text(20),
        )
        
        products.append(product)
    
    return products


def analyze_metrics(products: List[ProductMetrics]):
    """Análisis estadístico de las métricas"""
    
    print("=" * 80)
    print("ANÁLISIS ESTADÍSTICO DE MÉTRICAS DE VENTAS")
    print("=" * 80)
    print()
    
    # Separar productos con y sin datos
    products_with_sales = [p for p in products if p.prom_simple > 0 and p.has_trend]
    products_no_sales = [p for p in products if p.prom_simple == 0]
    
    print(f"📊 Total de productos: {len(products)}")
    print(f"   ✅ Con ventas históricas: {len(products_with_sales)}")
    print(f"   ❌ Sin ventas: {len(products_no_sales)}")
    print()
    
    if not products_with_sales:
        print("⚠️  No hay suficientes productos con ventas para análisis")
        return
    
    # 1. ANÁLISIS DE VARIABILIDAD
    print("=" * 80)
    print("1. ANÁLISIS DE VARIABILIDAD (menor = más estable)")
    print("=" * 80)
    print()
    
    metrics_data = {
        'Prom Simple': [p.prom_simple for p in products_with_sales],
        'Prom 3M': [p.prom_3m for p in products_with_sales],
        'Prom 6M': [p.prom_6m for p in products_with_sales],
        'WMA': [p.wma for p in products_with_sales],
        'EMA': [p.ema for p in products_with_sales],
        '6M+WMA': [p.wma_6m for p in products_with_sales],
        'Mediana': [p.mediana for p in products_with_sales],
    }
    
    # Filtrar infinitos para estadísticas
    def filter_finite(values):
        return [v for v in values if v != float('inf') and v > 0]
    
    cv_scores = {}
    for name, values in metrics_data.items():
        finite_values = filter_finite(values)
        if len(finite_values) > 1:
            mean = statistics.mean(finite_values)
            stdev = statistics.stdev(finite_values)
            cv = (stdev / mean) * 100 if mean > 0 else float('inf')
            cv_scores[name] = cv
            print(f"{name:15} - CV: {cv:6.2f}% | Media: {mean:6.2f} | StDev: {stdev:6.2f}")
    
    print()
    print("💡 Coeficiente de Variación (CV): menor = más consistente")
    best_cv = min(cv_scores.items(), key=lambda x: x[1])
    print(f"   🏆 Métrica más estable: {best_cv[0]} (CV: {best_cv[1]:.2f}%)")
    print()
    
    # 2. ANÁLISIS DE DIFERENCIAS ENTRE MÉTRICAS
    print("=" * 80)
    print("2. DIVERGENCIA ENTRE MÉTRICAS (detecta productos problemáticos)")
    print("=" * 80)
    print()
    
    high_divergence = []
    for p in products_with_sales:
        finite_vals = filter_finite([
            p.prom_simple, p.prom_3m, p.prom_6m, 
            p.wma, p.ema, p.wma_6m
        ])
        
        if len(finite_vals) >= 3:
            max_val = max(finite_vals)
            min_val = min(finite_vals)
            divergence = ((max_val - min_val) / min_val * 100) if min_val > 0 else 0
            
            if divergence > 100:  # Más de 100% de diferencia
                high_divergence.append((p, divergence))
    
    high_divergence.sort(key=lambda x: x[1], reverse=True)
    
    print(f"Productos con alta variabilidad entre métodos (>{100}% divergencia):")
    print()
    for i, (p, div) in enumerate(high_divergence[:10], 1):
        print(f"{i}. {p.code} - {p.description[:40]}")
        print(f"   Divergencia: {div:.1f}%")
        print(f"   Prom Simple: {p.prom_simple:.1f} | 3M: {p.prom_3m:.1f} | 6M: {p.prom_6m:.1f}")
        print(f"   WMA: {p.wma:.1f} | EMA: {p.ema:.1f} | 6M+WMA: {p.wma_6m:.1f}")
        print()
    
    # 3. ANÁLISIS POR CATEGORÍA DE PRODUCTO
    print("=" * 80)
    print("3. COMPORTAMIENTO POR TIPO DE VENTA")
    print("=" * 80)
    print()
    
    # Clasificar por comportamiento
    high_rotation = []  # Ventas > 10/mes
    medium_rotation = []  # Ventas 2-10/mes
    low_rotation = []  # Ventas < 2/mes
    
    for p in products_with_sales:
        if p.prom_simple > 10:
            high_rotation.append(p)
        elif p.prom_simple >= 2:
            medium_rotation.append(p)
        else:
            low_rotation.append(p)
    
    def analyze_category(products, name):
        if not products:
            return
        
        print(f"\n{name} ({len(products)} productos):")
        print("-" * 60)
        
        # Comparar métricas
        differences = {
            '3M vs Simple': [],
            '6M vs Simple': [],
            '6M+WMA vs Simple': [],
            'Mediana vs Simple': [],
        }
        
        for p in products:
            if p.prom_simple > 0:
                differences['3M vs Simple'].append(abs(p.prom_3m - p.prom_simple) / p.prom_simple * 100)
                differences['6M vs Simple'].append(abs(p.prom_6m - p.prom_simple) / p.prom_simple * 100)
                differences['6M+WMA vs Simple'].append(abs(p.wma_6m - p.prom_simple) / p.prom_simple * 100)
                if p.mediana > 0:
                    differences['Mediana vs Simple'].append(abs(p.mediana - p.prom_simple) / p.prom_simple * 100)
        
        for method, diffs in differences.items():
            finite_diffs = [d for d in diffs if d != float('inf')]
            if finite_diffs:
                avg_diff = statistics.mean(finite_diffs)
                print(f"  {method:20}: {avg_diff:6.1f}% diferencia promedio")
    
    analyze_category(high_rotation, "🔥 ALTA ROTACIÓN (>10 unidades/mes)")
    analyze_category(medium_rotation, "📊 ROTACIÓN MEDIA (2-10 unidades/mes)")
    analyze_category(low_rotation, "🐌 BAJA ROTACIÓN (<2 unidades/mes)")
    
    # 4. DETECCIÓN DE CASOS EXTREMOS
    print("\n" + "=" * 80)
    print("4. CASOS PROBLEMÁTICOS DETECTADOS")
    print("=" * 80)
    print()
    
    # Caso 1: Prom 3M mucho mayor que Simple (pico reciente)
    print("📈 Productos con PICOS RECIENTES (3M > 2x Simple):")
    recent_peaks = [p for p in products_with_sales if p.prom_3m > p.prom_simple * 2]
    for p in recent_peaks[:5]:
        print(f"  • {p.code}: Simple={p.prom_simple:.1f}, 3M={p.prom_3m:.1f}, 6M+WMA={p.wma_6m:.1f}")
    print(f"  Total: {len(recent_peaks)} productos")
    print()
    
    # Caso 2: Simple mucho mayor que 6M (ventas decrecientes)
    print("📉 Productos con VENTAS DECRECIENTES (Simple > 2x 6M):")
    declining = [p for p in products_with_sales if p.prom_simple > p.prom_6m * 2 and p.prom_6m > 0]
    for p in declining[:5]:
        print(f"  • {p.code}: Simple={p.prom_simple:.1f}, 6M={p.prom_6m:.1f}, 6M+WMA={p.wma_6m:.1f}")
    print(f"  Total: {len(declining)} productos")
    print()
    
    # Caso 3: Mediana muy diferente (outliers)
    print("⚠️  Productos con OUTLIERS (Mediana << Simple):")
    outliers = [p for p in products_with_sales if p.mediana > 0 and p.prom_simple > p.mediana * 3]
    for p in outliers[:5]:
        print(f"  • {p.code}: Simple={p.prom_simple:.1f}, Mediana={p.mediana:.1f}, 6M+WMA={p.wma_6m:.1f}")
    print(f"  Total: {len(outliers)} productos")
    print()
    
    # 5. RECOMENDACIONES FINALES
    print("=" * 80)
    print("5. 🎯 RECOMENDACIONES FINALES")
    print("=" * 80)
    print()
    
    # Calcular score por métrica
    scores = {
        'Prom Simple': 0,
        'Prom 3M': 0,
        'Prom 6M': 0,
        'WMA': 0,
        'EMA': 0,
        '6M+WMA': 0,
        'Mediana': 0,
    }
    
    # Puntos por estabilidad (CV bajo)
    cv_ranking = sorted(cv_scores.items(), key=lambda x: x[1])
    for i, (name, _) in enumerate(cv_ranking):
        scores[name] += (len(cv_ranking) - i) * 3
    
    # Puntos por balance en diferentes rotaciones
    for p in high_rotation:
        if p.prom_6m > 0:
            scores['Prom 6M'] += 1
            scores['6M+WMA'] += 2  # Mejor para alta rotación
    
    for p in medium_rotation:
        scores['6M+WMA'] += 2
        scores['Prom 6M'] += 1
    
    for p in low_rotation:
        scores['Mediana'] += 1
        scores['6M+WMA'] += 1
    
    # Penalizar métricas problemáticas
    scores['Prom 3M'] -= len(recent_peaks) * 2  # Muy volátil
    scores['Prom Simple'] -= len(declining)  # No detecta cambios
    
    print("Ranking de métricas (puntaje total):")
    print()
    ranking = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    for i, (name, score) in enumerate(ranking, 1):
        emoji = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else "  "
        print(f"{emoji} {i}. {name:15} - Score: {score:4d}")
    
    print()
    print("=" * 80)
    print("📋 CONCLUSIÓN")
    print("=" * 80)
    print()
    
    winner = ranking[0][0]
    runner_up = ranking[1][0]
    
    print(f"🏆 MÉTRICA RECOMENDADA PRINCIPAL: {winner}")
    print(f"🥈 MÉTRICA ALTERNATIVA/SECUNDARIA: {runner_up}")
    print()
    print("JUSTIFICACIÓN:")
    print()
    
    if winner == '6M+WMA':
        print("✅ 6M+WMA es la mejor opción porque:")
        print("   • Solo considera los últimos 6 meses (ignora historia antigua)")
        print("   • Pondera más los meses recientes (detecta tendencias)")
        print("   • No es tan volátil como 3M (más estable)")
        print("   • Funciona bien en alta, media y baja rotación")
    elif winner == 'Prom 6M':
        print("✅ Prom 6M es la mejor opción porque:")
        print("   • Balance entre actualidad y estabilidad")
        print("   • Fácil de entender y explicar")
        print("   • Buen comportamiento en diferentes rotaciones")
    
    print()
    print("⚠️  CASOS ESPECIALES DETECTADOS:")
    if recent_peaks:
        print(f"   • {len(recent_peaks)} productos con picos recientes → usar 6M+WMA en lugar de 3M")
    if declining:
        print(f"   • {len(declining)} productos con ventas decrecientes → 6M más realista que Simple")
    if outliers:
        print(f"   • {len(outliers)} productos con outliers → Mediana o 6M+WMA más confiable")
    
    print()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Uso: python analyze_sales_metrics.py <archivo.html>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    print(f"Analizando: {filepath}\n")
    
    try:
        products = parse_html(filepath)
        analyze_metrics(products)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


import pandas as pd
import numpy as np
import holidays
import argparse
from datetime import date
from google.cloud import bigquery

FECHA_INICIO = "2023-11-01"
FECHA_FIN = "2026-10-31"
PAIS = "CO"

INSUMOS = {
    # 3 Críticos
    "ELECTRODO_6013": {"base": 120, "ruido": 0.1, "unidad": "KG", "nombre": "Electrodo 6013", "cobertura": 3},
    "ACERO_A36": {"base": 500, "ruido": 0.15, "unidad": "KG", "nombre": "Acero A36", "cobertura": 4},
    "GAS_ARGON": {"base": 50, "ruido": 0.05, "unidad": "CIL", "nombre": "Gas Argón", "cobertura": 2},
    # 3 Advertencia
    "ALAMBRE_MIG": {"base": 200, "ruido": 0.1, "unidad": "KG", "nombre": "Alambre MIG", "cobertura": 7},
    "DISCO_CORTE": {"base": 300, "ruido": 0.2, "unidad": "UND", "nombre": "Disco de Corte 4.5", "cobertura": 8},
    "PINTURA_EPOX": {"base": 40, "ruido": 0.1, "unidad": "GAL", "nombre": "Pintura Epóxica", "cobertura": 6},
    # 6 Estables
    "THINNER": {"base": 60, "ruido": 0.1, "unidad": "GAL", "nombre": "Thinner Standard", "cobertura": 15},
    "LIQ_PENET": {"base": 15, "ruido": 0.3, "unidad": "LTS", "nombre": "Líquido Penetrante", "cobertura": 20},
    "TRAPO_IND": {"base": 100, "ruido": 0.1, "unidad": "KG", "nombre": "Trapo Industrial", "cobertura": 25},
    "GUANTE_CARN": {"base": 80, "ruido": 0.15, "unidad": "PAR", "nombre": "Guante Carnaza", "cobertura": 30},
    "MASCARILLA": {"base": 150, "ruido": 0.1, "unidad": "UND", "nombre": "Mascarilla N95", "cobertura": 30},
    "TAPON_OIDO": {"base": 200, "ruido": 0.05, "unidad": "PAR", "nombre": "Tapón Auditivo", "cobertura": 40},
}

def generar_historia():
    fechas = pd.date_range(start=FECHA_INICIO, end=FECHA_FIN, freq='D')
    festivos_co = holidays.country_holidays(PAIS, years=[2023, 2024, 2025, 2026])
    
    registros = []
    np.random.seed(42)

    for id_insumo, props in INSUMOS.items():
        base = props["base"]
        for i, f in enumerate(fechas):
            tendencia = 1 + (i / len(fechas)) * 0.1
            dia_del_ano = f.timetuple().tm_yday
            estacionalidad = 1 + 0.3 * np.sin(2 * np.pi * (dia_del_ano - 243) / 365)
            patron_semanal = 0.05 if f.weekday() == 6 else 1.0
            
            evento = 1.0
            if f in festivos_co:
                evento = 0.1
            elif f.month == 12 and f.day > 24:
                evento = 0.3
            elif f.month in [3, 4] and f.weekday() in [3, 4] and f.day < 15:
                evento = 0.1

            salto_estructural = 1.3 if id_insumo == "ALAMBRE_MIG" and f >= pd.to_datetime("2026-03-01") else 1.0
            ruido = np.random.normal(1, props["ruido"])
            pico = 1.5 if np.random.rand() > 0.98 else 1.0
            
            consumo = max(0, base * tendencia * estacionalidad * patron_semanal * evento * salto_estructural * ruido * pico)
            
            registros.append({
                "fecha": f.date(),
                "id_insumo": id_insumo,
                "cantidad_consumida": round(consumo, 2)
            })
            
    return pd.DataFrame(registros)

def generar_stock_actual(df_historico):
    fecha_corte = pd.to_datetime(FECHA_FIN).date()
    ultimos_28 = df_historico[df_historico["fecha"] > (fecha_corte - pd.Timedelta(days=28))]
    consumo_diario_promedio = ultimos_28.groupby("id_insumo")["cantidad_consumida"].mean()
    
    registros = []
    for id_insumo, props in INSUMOS.items():
        cdp = consumo_diario_promedio.get(id_insumo, props["base"])
        punto_reorden = cdp * 10
        stock_actual = cdp * props["cobertura"]
        
        registros.append({
            "id_insumo": id_insumo,
            "nombre": props["nombre"],
            "unidad": props["unidad"],
            "stock_actual": round(stock_actual, 2),
            "punto_reorden": round(punto_reorden, 2),
            "lead_time_dias": 10,
            "fecha_corte": fecha_corte
        })
    return pd.DataFrame(registros)

def cargar_a_bq(df, tabla):
    client = bigquery.Client()
    table_id = f"supply_chain.{tabla}"
    job_config = bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE")
    job = client.load_table_from_dataframe(df, table_id, job_config=job_config)
    job.result()
    print(f"✅ Cargadas {len(df)} filas en {table_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    args = parser.parse_args()

    print("Generando datos...")
    df_hist = generar_historia()
    df_curr = generar_stock_actual(df_hist)
    
    if args.upload:
        cargar_a_bq(df_hist, "historical_inventory")
        cargar_a_bq(df_curr, "current_inventory")
    else:
        print("Usa --upload para reemplazar las tablas en BigQuery.")
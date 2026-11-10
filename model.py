import pandas as pd
import numpy as np

def calculate_linkage_effects(A_matrix):
    """
    Leontief 역행렬 (I - A)^(-1)을 이용하여 
    영향력계수(Power Dispersion) 및 감응도계수(Sensitivity Dispersion) 산출
    """
    I = np.identity(len(A_matrix))
    L = np.linalg.inv(I - A_matrix)  # 생산유발계수 행렬
    
    n = L.shape[0]
    
    # 영향력계수 (열합 / 전체평균)
    column_sums = L.sum(axis=0)
    power_dispersion = column_sums / (L.sum() / n)
    
    # 감응도계수 (행합 / 전체평균)
    row_sums = L.sum(axis=1)
    sensitivity_dispersion = row_sums / (L.sum() / n)
    
    return {
        "power": power_dispersion.tolist(),
        "sensitivity": sensitivity_dispersion.tolist(),
        "leontief": L.tolist()
    }

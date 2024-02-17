import csv
import json
import requests

#url = 'http://localhost:3000/'
url = 'https://epublit.com.ar:8443/'

headers = {}

def add_libros(libros):
    for libro in libros:
        print("ISBN: ", libro["isbn"])
        res = requests.post(url+'libro/', json=libro, headers=headers)

        if (not res.json()["success"]):
            print(res.text)
        else:
            print(res.json())

def login():
    data = {
        "username": "caro",
        "password": "Lautaro123."
    }
    res = requests.post(url+'user/login', json=data)

    if (res.status_code != 200 or not res.json()["token"]):
        print(res.json())
        exit(1)

    headers["Authorization"] = res.json()["token"]
    print(headers)

if __name__ == "__main__":
    file_path = 'libros_2.csv'

    login()

    with open(file_path, encoding='utf-8') as file:
        _libros = csv.DictReader(file)
        libros = []

        dni = 98
        for libro in _libros:
            libros.append({
                "titulo": libro["Detalle"],
                "isbn": libro["Codigo"].replace('-', ''),
                "precio": int(libro["Precio"].replace('$', '').replace(',', '').replace('.', '')),
                "stock": int(libro["Stk"]),
                "fecha_edicion": "2023-08-02",
                "autores": [{
                    "nombre": libro["Autor"],
                    "dni": str(dni),
                    "porcentaje": 0
                }]
            })
            dni += 1

        print(json.dumps(libros, indent=4))

        add_libros(libros)

        


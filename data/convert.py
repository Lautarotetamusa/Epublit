#Convert the csv data extracted from Wix to database data

import csv
import json
import requests

#url = 'http://localhost:3000/'
url = 'https://epublit.com.ar:8443/'

headers = {}

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

def add_libros(libros):
    for libro in libros:
        res = requests.post(url+'libro/', json=libro, headers=headers)

        if (not res.json()["success"]):
            print(res.text)


def add_personas(personas):
    for i in personas:
        res = requests.post(url+'persona/', json=personas[i], headers=headers)

        if (not res.json()["success"]):
            print(res.text)
        elif 'id' in res.json():
            personas[i]["id"] = int(res.json()["id"])

    return personas

def find_dni(personas, dni):
    for p in personas:
        print(p["dni"], " == ", dni)
        if p["dni"] == dni:
            return p

def get_personas(personas):
    res = requests.get(url+'persona/', headers=headers)
    for i in personas:
        personas[i]["id"] = find_dni(res.json(), personas[i]["dni"])["id"]

    return personas

if __name__ == "__main__":
    personas = {}
    libros = []

    login()

    with open('Autorxs.csv', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)

        dni = 1
        for line in reader:
            
            personas[line[1]] = {
                "nombre": line[0],
                "id": line[1],
                "dni": str(dni)
            }
            dni += 1
    #personas = add_personas(personas)
    personas = get_personas(personas)

    with open('Libros.csv', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)

        #"autores": [personas[a] for a in autores],
        #"ilustradores": [personas[line[4]]] if line[4] in personas else [],

        for line in reader:
            autores      = [{"tipo": 0, "porcentaje": 0, "id": personas[a]["id"]} for a in json.loads(line[3])]
            ilustradores = [{"tipo": 1, "porcentaje": 0, "id": personas[line[4]]["id"]}] if line[4] else []

            print("autores: ", autores)
            print("ilustradores: ", ilustradores)

            libro = {
                "titulo": line[1],
                "isbn": line[2].replace('ISBN ', '').replace('-', ''),
                "fecha_edicion": line[5],
                "precio": 0,
                "autores": autores,
                "ilustradores": ilustradores
            }

            res = requests.post(url+'libro/', json=libro, headers=headers)

            if (not res.json()["success"]):
                print(res.text)

    #print(json.dumps(personas, indent=4))
    with open('Libros.json', 'w') as f:
        json.dump(libros, f, ensure_ascii=False, indent=4)


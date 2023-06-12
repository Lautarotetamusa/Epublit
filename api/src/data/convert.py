#Convert the csv data extracted from Wix to database data

import csv
import json
import requests

url = 'http://localhost:3000/'

def add_libros(libros):
    for libro in libros:
        res = requests.post(url+'libro/', json=libro)

        if (not res.json()["success"]):
            print(res.text)


def add_personas(personas):
    for persona in personas:
        res = requests.post(url+'persona/', json=persona)

        if (not res.json()["success"]):
            print(res.text)
        elif 'id' in res.json():
            persona["id"] = res.json()["id"]

    return personas


if __name__ == "__main__":
    personas = {}
    libros = []

    with open('Autorxs.csv', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)

        dni = 1
        for line in reader:
            
            personas[line[1]] = {
                "nombre": line[0],
                "dni": dni
            }
            dni += 1
    personas = add_personas(personas)
    

    with open('Libros.csv', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)

        #"autores": [personas[a] for a in autores],
        #"ilustradores": [personas[line[4]]] if line[4] in personas else [],

        for line in reader:
            autores      = [{"tipo": 0, "id": personas[a]["id"]} for a in json.loads(line[3])]
            ilustradores = [{"tipo": 1, "id": personas[i]["id"]} for i in json.loads(line[4])]

            libro = {
                "titulo": line[1],
                "isbn": line[2].replace('ISBN ', '').replace('-', ''),
                "fecha_edicion": line[5],
                "precio": 0
            }

            res = requests.post(url+'libro/', json=libro)

            if (not res.json()["success"]):
                print(res.text)

            print(autores.append(ilustradores))

            res = requests.post(url+'libro/'+libro["isbn"]+'/personas', json=autores.append(ilustradores))
            if (not res.json()["success"]):
                print(res.text)

            libros.append(libro)
                    
            #print(libros[line[0]]["titulo"])

    #add_libros(libros)

    #print(json.dumps(personas, indent=4))
    with open('Libros.json', 'w') as f:
        json.dump(libros, f, ensure_ascii=False, indent=4)


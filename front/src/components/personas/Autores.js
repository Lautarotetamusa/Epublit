import React, { useState, useEffect } from "react";
import { DataPersonTable } from "./DataTable";
import { GetPeople } from "../ApiHandler";

export const Autores = () => {
  const [authors, setAuthors] = useState([]);
  const fetchAuthors = async () => {
    const data = await GetPeople("autor");
    setAuthors(data);
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  return (
    <div>
      <DataPersonTable data={authors} setPeople={setAuthors} type={"Autores"} />
    </div>
  );
};

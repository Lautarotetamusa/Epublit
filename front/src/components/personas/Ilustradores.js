import React, { useState, useEffect } from "react";
import { DataPersonTable } from "./DataTable";
import { GetPeople } from "../ApiHandler";

export const Ilustradores = () => {
  const [illustrators, setIllustrators] = useState([]);

  const fetchIllustrators = async () => {
    const data = await GetPeople("ilustrador");
    setIllustrators(data);
  };

  useEffect(() => {
    fetchIllustrators();
  }, []);

  return (
    <div>
      <DataPersonTable
        data={illustrators}
        setPeople={setIllustrators}
        type={"Ilustradores"}
      />
    </div>
  );
};

import React, { createContext, useState, useContext, useEffect } from "react";
import { PostLogin, setToken } from "../components/ApiHandler";

const PersonContext = createContext();

export const PersonProvider = ({ children }) => {
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoggedUser = async () => {
      const loggedUser = await localStorage.getItem("loggedUser");
      if (loggedUser) {
        const parsedUser = JSON.parse(loggedUser);
        setUser(parsedUser);
        setToken(parsedUser.token);
      }
      setLoading(false);
    };
    fetchLoggedUser();
  }, []);

  const doLogin = async (inputs) => {
    const response = await PostLogin(inputs);
    if (response.success) {
      await localStorage.setItem(
        "loggedUser",
        JSON.stringify({ username: inputs.username, token: response.token })
      );
      setUser({ username: inputs.username, token: response.token });
      setToken(response.token);
    }
  };

  const doLogout = () => {
    localStorage.removeItem("loggedUser");
    setUser({});
    setToken("");
  };

  return (
    <PersonContext.Provider value={{ user, doLogin, doLogout, loading }}>
      {children}
    </PersonContext.Provider>
  );
};

export const usePerson = () => {
  const context = useContext(PersonContext);
  if (!context) {
    throw new Error("usePerson must be used within a PersonProvider");
  }
  return context;
};

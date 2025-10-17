import { useEffect, useState } from "react";
import axios from "axios";
import "./styles.css";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [airports, setAirports] = useState();

  const fetchCountries = async () => {
    try {
      setLoading(true);
      const response = await axios.get("https://airportgap.com/api/airports");
      setAirports(response.data.data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching countries:", err);
      setError("Hubo un error al obtener los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  if (loading) return <p aria-label="loading">Cargando aeropuertos...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="App">
      <h1>Lista de aeropuertos</h1>
      {airports.length === 0 ? (
        <h1 data-testid="empty">No se encontraron aeropuertos</h1>
      ) : null}
      <div>
        {airports.map((airport) => (
          <div key={airport.id} data-testid="airport-item">
            <h3>{airport.id}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
    import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Guitar } from "./components/Guitar";
import axios from "axios";
import "./styles.css";

export default function App() {
  const [auth, setAuth] = useState(false);

  return (
    <>
      <Header />

      <main className="container-xl mt-5">
        <h2 className="text-center">Nuestra Colección</h2>

        <div className="row mt-5">
          <Guitar />
        </div>
      </main>

      <footer class="bg-dark mt-5 py-5">
        <div class="container-xl">
          <p class="text-white text-center fs-4 mt-4 m-md-0">
            GuitarLA - Todos los derechos Reservados
          </p>
        </div>
      </footer>
    </>
  );
}

    

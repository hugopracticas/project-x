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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Crear carpeta "Components" agregar componente Header y Guitar
Header
export const Header = () => {
  return (
    <header className="py-5 header">
      <div className="container-xl">
        <div className="row justify-content-center justify-content-md-between">
          <div className="col-8 col-md-3">
            <a href="index.html">
              <img
                class="img-fluid"
                src="./public/img/logo.svg"
                alt="imagen logo"
              />
            </a>
          </div>
          <nav className="col-md-6 a mt-5 d-flex align-items-start justify-content-end">
            <div className="carrito">
              <img
                className="img-fluid"
                src="./public/img/carrito.png"
                alt="imagen carrito"
              />

              <div id="carrito" className="bg-white p-3">
                <p className="text-center">El carrito esta vacio</p>
                <table className="w-100 table">
                  <thead>
                    <tr>
                      <th>Imagen</th>
                      <th>Nombre</th>
                      <th>Precio</th>
                      <th>Cantidad</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <img
                          className="img-fluid"
                          src="./public/img/guitarra_02.jpg"
                          alt="imagen guitarra"
                        />
                      </td>
                      <td>SRV</td>
                      <td className="fw-bold">$299</td>
                      <td className="flex align-items-start gap-4">
                        <button type="button" className="btn btn-dark">
                          -
                        </button>
                        1
                        <button type="button" className="btn btn-dark">
                          +
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-danger" type="button">
                          X
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p className="text-end">
                  Total pagar: <span className="fw-bold">$899</span>
                </p>
                <button className="btn btn-dark w-100 mt-3 p-2">
                  Vaciar Carrito
                </button>
              </div>
            </div>-
          </nav>
        </div>
      </div>
    </header>
  );
};
(((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((
export const Guitar = () => {
  return (
    <div className="col-md-6 col-lg-4 my-4 row align-items-center">
      <div className="col-4">
        <img
          className="img-fluid"
          src="./public/img/guitarra_01.jpg"
          alt="imagen guitarra"
        />
      </div>
      <div className="col-8">
        <h3 className="text-black fs-4 fw-bold text-uppercase">Lukather</h3>
        <p>
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Sit quae
          labore odit magnam in autem nesciunt, amet deserunt
        </p>
        <p className="fw-black text-primary fs-3">$299</p>
        <button type="button" className="btn btn-dark w-100">
          Agregar al Carrito
        </button>
      </div>
    </div>
  );
};


    

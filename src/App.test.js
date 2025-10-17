// src/App.test.jsx
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import axios from "axios";

jest.mock("axios");

const mockAirports = [{ id: "AAA" }, { id: "BBB" }];

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
});

test("", async () => {
  axios.get.mockResolvedValueOnce({ data: { data: mockAirports } });

  render(<App />);
  expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();

  // Espera a que desaparezca el loading para no “carrera”
  await waitFor(() => {
    expect(screen.queryByLabelText(/loading/i)).not.toBeInTheDocument();
  });
});

test("renderiza los aeropuertos cuando la petición es exitosa", async () => {
  axios.get.mockResolvedValueOnce({ data: { data: mockAirports } });

  render(<App />);

  // espera a que aparezca algún item
  const items = await screen.findAllByTestId("airport-item");
  expect(items).toHaveLength(2);
  expect(screen.getByText("AAA")).toBeInTheDocument();
  expect(screen.getByText("BBB")).toBeInTheDocument();
  // no debe mostrar vacío
  expect(screen.queryByTestId("empty")).not.toBeInTheDocument();
});

test("muestra mensaje de lista vacía cuando no hay resultados", async () => {
  axios.get.mockResolvedValueOnce({ data: { data: [] } });

  render(<App />);

  expect(await screen.findByTestId("empty")).toBeInTheDocument();
});

test("muestra error cuando la petición falla", async () => {
  axios.get.mockRejectedValueOnce(new Error("Network error"));

  render(<App />);

  // Role alert por accesibilidad
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Hubo un error al obtener los datos."
  );
});

import { useEffect, useState } from "react";
import { getData } from "../../data/getDataApi";

export const RickMortyList = () => {
  const [data, setData] = useState({ results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getInfoFromApi = async () => {
    try {
      const res = await getData();
      setData(res.data);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getInfoFromApi();
  }, []);

  if (loading) return <p>Cargando…</p>;
  if (error) return <p>Ups, algo falló {String(error)}</p>;

  return (
    <div>
      {data.results.map((r) => (
        <div key={r.id}>
          <h2>{r.name}</h2>
        </div>
      ))}
    </div>
  );
};

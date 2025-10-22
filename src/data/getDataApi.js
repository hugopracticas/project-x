import axios from "axios";

const baseUrl = "https://rickandmortyapi.com/api/character"

export const getData = async () => {
    try {
      const response = await axios.get(baseUrl)
      const {data, status} = response
      console.log(data);
      return { data, status }
    } catch (error) {
        console.log(error);
        throw error;
    }
}



/**
 * 
 * Name: hugopracticas
 * Key: hugopracticasprojectx
 * TOKEN: 0b049f265d5b4f723f36ce469fac51fe21fa0468
*/
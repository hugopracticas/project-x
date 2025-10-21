import { render, screen, waitFor } from '@testing-library/react';
import { RickMortyList } from './RickMortyList';


jest.mock('../../data/getDataApi', () => ({
    getData: jest.fn()
}));

import { getData } from '../../data/getDataApi';


describe('RickMortyList', () => {
    afterEach(() => {
        jest.clearAllMocks();
    })

    test('muestra estado de cargando inicialmente', () => {
        render(<RickMortyList />)
        expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
    })

    test('Renderiza la lista cuando la peticion tiene exito', async () => {
        getData.mockResolvedValueOnce({
            data: {
                results: [
                    {id: 1, name: 'Rick Sanchez'},
                    {id: 2, name: 'Morty Smith'}
                ]
            },
            status: 200
        });

        render(<RickMortyList />)

        await waitFor(() => {
            expect(screen.getByText('Rick Sanchez')).toBeInTheDocument();
            expect(screen.getByText('Morty Smith')).toBeInTheDocument();
        })
    })

    test('Muestra mensaje de error cuando la peticion falla', async () => {
        getData.mockRejectedValueOnce(new Error('Network error'));

        render(<RickMortyList />);

        await waitFor(() => {
            expect(screen.getByText(/Ups, algo falló/i)).toBeInTheDocument()
        })
    })
})


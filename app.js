async function buscarDadosClima() {
    try {
        let buscaClima = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-26.47858&longitude=-49.09274&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`);
        let buscaClimaConvertido = await buscaClima.json();
        if(buscaClimaConvertido.error) {
            throw new Error("Dados climáticos não encontrados!");
        }
        console.log(buscaClimaConvertido);
        return buscaClimaConvertido;
    } catch (erro) {
        throw new Error(erro);
    }
}

buscarDadosClima();
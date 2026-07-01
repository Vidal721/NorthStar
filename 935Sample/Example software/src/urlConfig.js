const api_url = true;

export function useURL () {
    if (api_url == true) {
        console.log("https://taco-childhood-jailbreak.ngrok-free.dev");
        return "https://taco-childhood-jailbreak.ngrok-free.dev";
    } else {
        console.log("http://localhost:3000");
        return "http://localhost:3000"
    }
}
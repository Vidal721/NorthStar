const api_url = false;

export function useURL () {
    if (api_url == true) {
        console.log("Using https://taco-childhood-jailbreak.ngrok-free.dev as the backend url.");
        return "https://taco-childhood-jailbreak.ngrok-free.dev";
    } else {
        console.log("Using http://localhost:3000 as the backend url.");
        return "http://localhost:3000"
    }
}

import { useEffect, useState } from "react";
import { getMe, updateMe } from "../../api/user";
import type { User, UpdateUserInput } from "../../api/user";

export function usePerfil() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        const response = await getMe();
        setUser(response.data);
        setLoading(false);
    };

    useEffect(() => {
        fetchUser();
    }, []);

    const update = async (input: UpdateUserInput) => {
        const response = await updateMe(input);
        setUser(response.data);
    };

    return { user, loading, update };
}

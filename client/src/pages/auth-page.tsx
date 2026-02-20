import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Factory } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function AuthPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const searchParams = new URLSearchParams(window.location.search);
    const initialRefCode = searchParams.get("ref") || "";

    // Login form state
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // Register form state
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regFirstName, setRegFirstName] = useState("");
    const [regLastName, setRegLastName] = useState("");
    const [regReferralCode, setRegReferralCode] = useState(initialRefCode);

    const [isLogin, setIsLogin] = useState(!initialRefCode);

    const loginMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to login");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            toast({ title: "Успешный вход", description: "Добро пожаловать в MetaMill!" });
            setLocation("/");
        },
        onError: (error: Error) => {
            toast({
                title: "Ошибка входа",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const registerMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: regEmail,
                    password: regPassword,
                    firstName: regFirstName,
                    lastName: regLastName,
                    referralCode: regReferralCode,
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to register");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            toast({ title: "Регистрация успешна", description: "Добро пожаловать в MetaMill!" });
            setLocation("/");
        },
        onError: (error: Error) => {
            toast({
                title: "Ошибка регистрации",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    return (
        <div className="min-h-screen bg-background flex flex-colitems-center justify-center p-4">
            <div className="absolute top-8 left-8 flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                    <Factory className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <span className="text-base font-bold tracking-tight">MetaMill</span>
                </div>
            </div>

            <div className="w-full max-w-md mx-auto mt-20">
                <Tabs defaultValue={isLogin ? "login" : "register"} onValueChange={(v) => setIsLogin(v === "login")}>
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                        <TabsTrigger value="login">Вход</TabsTrigger>
                        <TabsTrigger value="register">Регистрация</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <Card>
                            <CardHeader>
                                <CardTitle>Добро пожаловать</CardTitle>
                                <CardDescription>
                                    Войдите в свой аккаунт для управления контентом
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Пароль</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={() => loginMutation.mutate()}
                                    disabled={loginMutation.isPending || !loginEmail || !loginPassword}
                                >
                                    {loginMutation.isPending ? "Вход..." : "Войти"}
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="register">
                        <Card>
                            <CardHeader>
                                <CardTitle>Создать аккаунт</CardTitle>
                                <CardDescription>
                                    Начните автоматизировать публикации прямо сейчас
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">Имя</Label>
                                        <Input
                                            id="firstName"
                                            placeholder="Иван"
                                            value={regFirstName}
                                            onChange={(e) => setRegFirstName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Фамилия</Label>
                                        <Input
                                            id="lastName"
                                            placeholder="Иванов"
                                            value={regLastName}
                                            onChange={(e) => setRegLastName(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-email">Email</Label>
                                    <Input
                                        id="reg-email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-password">Пароль</Label>
                                    <Input
                                        id="reg-password"
                                        type="password"
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-referralCode">Реферальный код (опционально)</Label>
                                    <Input
                                        id="reg-referralCode"
                                        placeholder="REF-XXXXX"
                                        value={regReferralCode}
                                        onChange={(e) => setRegReferralCode(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={() => registerMutation.mutate()}
                                    disabled={registerMutation.isPending || !regEmail || !regPassword}
                                >
                                    {registerMutation.isPending ? "Регистрация..." : "Зарегистрироваться"}
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}


import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Zap, Crown, Rocket } from "lucide-react";

interface SubscriptionData {
    plan: string;
    balance: number;
    credits: number;
    subscription: any;
}

export default function Pricing() {
    const { toast } = useToast();
    const { data: subData } = useQuery<SubscriptionData>({
        queryKey: ["/api/subscription"],
    });

    const subscribeMutation = useMutation({
        mutationFn: async (plan: string) => {
            const res = await apiRequest("POST", "/api/subscribe", { plan });
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
            toast({ title: "Подписка оформлена!", description: `Вам начислено ${data.balance} кредитов.` });
        },
        onError: (e: any) => {
            toast({ title: "Ошибка", description: e.message, variant: "destructive" });
        }
    });

    const currentPlan = subData?.plan || "basic";

    const tiers = [
        {
            id: "basic",
            name: "Basic",
            price: "Бесплатно",
            period: "",
            description: "Для старта и знакомства с MetaMill.",
            icon: <Zap className="h-6 w-6 text-blue-400" />,
            features: [
                "200 кредитов",
                "1 аккаунт Threads",
                "10 AI генераций/день",
                "Базовая аналитика",
                "10% реферальный бонус"
            ],
            cta: currentPlan === "basic" ? "Текущий тариф" : "Начать",
            variant: "outline" as const,
            gradient: "from-blue-500/10 to-transparent",
            border: "border-blue-500/20"
        },
        {
            id: "pro",
            name: "Pro",
            price: "$29",
            period: "/мес",
            description: "Для активных авторов и продвижения.",
            icon: <Crown className="h-6 w-6 text-purple-400" />,
            features: [
                "1 000 кредитов",
                "3 аккаунта Threads",
                "Безлимит AI генераций",
                "Авто-постинг по расписанию",
                "Продвинутая аналитика",
                "20% реферальный бонус"
            ],
            cta: currentPlan === "pro" ? "Текущий тариф" : "Перейти на Pro",
            variant: "default" as const,
            popular: true,
            gradient: "from-purple-500/10 to-pink-500/10",
            border: "border-purple-500/30"
        },
        {
            id: "extra",
            name: "Extra",
            price: "$99",
            period: "/мес",
            description: "Для агентств и масштабного продвижения.",
            icon: <Rocket className="h-6 w-6 text-orange-400" />,
            features: [
                "3 000 кредитов",
                "Безлимит аккаунтов",
                "API доступ",
                "Персональная поддержка 24/7",
                "White-label отчёты",
                "30% реферальный бонус"
            ],
            cta: currentPlan === "extra" ? "Текущий тариф" : "Перейти на Extra",
            variant: "outline" as const,
            gradient: "from-orange-500/10 to-red-500/10",
            border: "border-orange-500/20"
        }
    ];

    return (
        <div className="min-h-screen bg-background py-20 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                    Тарифы MetaMill
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Выберите тариф для вашего роста. Без скрытых платежей.
                </p>
            </div>

            {subData && (
                <div className="text-center mb-12">
                    <Badge variant="outline" className="text-sm px-4 py-1">
                        Ваш баланс: <span className="font-bold ml-1">{subData.balance} кредитов</span>
                    </Badge>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {tiers.map((tier) => (
                    <Card
                        key={tier.id}
                        className={`relative flex flex-col bg-gradient-to-br ${tier.gradient} ${tier.border} ${tier.popular ? 'shadow-lg shadow-purple-500/10 scale-105' : ''
                            } ${currentPlan === tier.id ? 'ring-2 ring-primary' : ''}`}
                    >
                        {tier.popular && (
                            <div className="absolute -top-4 left-0 right-0 flex justify-center">
                                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-3 py-1">
                                    Популярный
                                </Badge>
                            </div>
                        )}
                        {currentPlan === tier.id && (
                            <div className="absolute -top-4 right-4">
                                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                    Активен
                                </Badge>
                            </div>
                        )}
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-2">
                                {tier.icon}
                                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                            </div>
                            <CardDescription>{tier.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="text-4xl font-bold mb-6">
                                {tier.price}
                                {tier.period && (
                                    <span className="text-base font-normal text-muted-foreground">{tier.period}</span>
                                )}
                            </div>
                            <ul className="space-y-3">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-green-400 shrink-0" />
                                        <span className="text-muted-foreground text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className={`w-full ${tier.popular ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-0 hover:opacity-90' : ''}`}
                                variant={tier.variant}
                                disabled={currentPlan === tier.id || subscribeMutation.isPending}
                                onClick={() => subscribeMutation.mutate(tier.id)}
                            >
                                {subscribeMutation.isPending ? "Обработка..." : tier.cta}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}

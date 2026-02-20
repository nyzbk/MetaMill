
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Gift, Copy, Share2, Wallet, Users, TrendingUp, ExternalLink } from "lucide-react";

interface PartnerStats {
    referralCode: string | null;
    earnings: number;
    balance: number;
    signups: number;
    clicks: number;
}

interface Referral {
    id: string;
    email: string | null;
    createdAt: string;
}

interface Payout {
    id: number;
    referredUserId: string;
    amount: number;
    percentage: number;
    status: string;
    createdAt: string;
}

export default function PartnerDashboard() {
    const { toast } = useToast();
    const { data: stats, isLoading } = useQuery<PartnerStats>({
        queryKey: ["/api/partners/stats"],
    });

    const { data: refData } = useQuery<{ referrals: Referral[]; payouts: Payout[] }>({
        queryKey: ["/api/partners/referrals"],
    });

    const createCodeMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/referrals/create", {});
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/partners/stats"] });
            toast({ title: "Код создан!", description: "Ваш реферальный код готов к использованию." });
        }
    });

    const copyLink = () => {
        if (stats?.referralCode) {
            navigator.clipboard.writeText(`https://metamill.app/signup?ref=${stats.referralCode}`);
            toast({ title: "Скопировано!", description: "Реферальная ссылка скопирована в буфер обмена." });
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Загрузка партнёрских данных...</div>;
    }

    const conversionRate = stats?.clicks ? ((stats.signups / stats.clicks) * 100).toFixed(1) : "0";

    return (
        <div className="container mx-auto py-12 px-4 max-w-5xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                <div>
                    <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                        Партнёрская программа
                    </h1>
                    <p className="text-muted-foreground">
                        Приглашайте пользователей и получайте до 30% от их оплат в кредитах.
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-10">
                <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                            Общий заработок <Gift className="h-4 w-4 text-purple-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats?.earnings || 0} <span className="text-sm text-muted-foreground">кредитов</span></div>
                        <p className="text-xs text-green-400 mt-1">Баланс: {stats?.balance || 0} кредитов</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                            Рефералы <Users className="h-4 w-4 text-blue-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats?.signups || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Из ~{stats?.clicks || 0} переходов</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                            Конверсия <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{conversionRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Среднее по индустрии: 2.5%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Referral Link */}
            <Card className="mb-10">
                <CardHeader>
                    <CardTitle>Ваша реферальная ссылка</CardTitle>
                    <CardDescription>Делитесь этой ссылкой — рефералы отслеживаются автоматически.</CardDescription>
                </CardHeader>
                <CardContent>
                    {stats?.referralCode ? (
                        <div className="flex gap-2">
                            <Input
                                value={`https://metamill.app/signup?ref=${stats.referralCode}`}
                                readOnly
                                className="font-mono text-sm bg-muted/50"
                            />
                            <Button onClick={copyLink} variant="secondary">
                                <Copy className="h-4 w-4 mr-2" /> Копировать
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <p className="mb-4 text-muted-foreground">У вас ещё нет реферального кода.</p>
                            <Button
                                onClick={() => createCodeMutation.mutate()}
                                disabled={createCodeMutation.isPending}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 border-0"
                            >
                                {createCodeMutation.isPending ? "Создаём..." : "Создать реферальный код"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Commission Info */}
            <Card className="mb-10 bg-gradient-to-br from-green-500/5 to-transparent border-green-500/20">
                <CardHeader>
                    <CardTitle className="text-lg">Как это работает</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div className="p-4 rounded-lg bg-muted/30">
                            <div className="font-bold text-lg text-blue-400 mb-1">Basic</div>
                            <div>10% от оплаты реферала</div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30">
                            <div className="font-bold text-lg text-purple-400 mb-1">Pro</div>
                            <div>20% от оплаты реферала</div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30">
                            <div className="font-bold text-lg text-orange-400 mb-1">Extra</div>
                            <div>30% от оплаты реферала</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Referral History */}
            <Card className="mb-10">
                <CardHeader>
                    <CardTitle>Ваши рефералы</CardTitle>
                </CardHeader>
                <CardContent>
                    {refData?.referrals && refData.referrals.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Дата регистрации</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {refData.referrals.map((ref) => (
                                    <TableRow key={ref.id}>
                                        <TableCell className="font-medium">{ref.email || ref.id.substring(0, 8)}</TableCell>
                                        <TableCell className="text-muted-foreground">{new Date(ref.createdAt).toLocaleDateString("ru")}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-sm text-center text-muted-foreground py-8">
                            Пока нет рефералов. Поделитесь ссылкой, чтобы начать зарабатывать!
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payout History */}
            {refData?.payouts && refData.payouts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>История выплат</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Дата</TableHead>
                                    <TableHead>Кредиты</TableHead>
                                    <TableHead>Процент</TableHead>
                                    <TableHead>Статус</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {refData.payouts.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{new Date(p.createdAt).toLocaleDateString("ru")}</TableCell>
                                        <TableCell className="font-bold text-green-400">+{p.amount}</TableCell>
                                        <TableCell>{p.percentage}%</TableCell>
                                        <TableCell>
                                            <Badge variant={p.status === "paid" ? "outline" : "secondary"} className={p.status === "paid" ? "text-green-400 border-green-500/30" : ""}>
                                                {p.status === "paid" ? "Начислено" : "Ожидает"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, DollarSign, Users, BarChart3 } from "lucide-react";
import { Link } from "wouter";

export default function Partners() {
    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <section className="py-20 px-4 text-center border-b border-border/50 bg-gradient-to-b from-background to-secondary/10">
                <div className="max-w-4xl mx-auto space-y-6">
                    <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                        Earn 50% from Every Referral
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Join the MetaMill Partner Program. Bring clients to the best Threads automation tool and get 50% from the first payment + 30% lifetime commission.
                    </p>
                    <div className="flex justify-center gap-4 pt-4">
                        <Link href="/partner-dashboard">
                            <Button size="lg" className="text-lg px-8">
                                Become a Partner <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Button size="lg" variant="outline" className="text-lg px-8">
                            Calculate Income
                        </Button>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 px-4 max-w-7xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-12">Why Partner with MetaMill?</h2>
                <div className="grid md:grid-cols-3 gap-8">
                    <Card className="bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <DollarSign className="h-12 w-12 text-primary mb-4" />
                            <CardTitle>High Commission</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Earn industry-leading commissions. 50% upfront for new signups and distinct recurring revenue for life.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <Users className="h-12 w-12 text-primary mb-4" />
                            <CardTitle>Growing Market</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Threads is booming. Be the first to offer a comprehensive monitoring and automation solution to your audience.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <BarChart3 className="h-12 w-12 text-primary mb-4" />
                            <CardTitle>Transparent Tracking</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Real-time dashboard to track your clicks, signups, and payouts. Know exactly how much you earn.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-primary/5 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-bold mb-6">Ready to Start Earning?</h2>
                    <p className="text-lg text-muted-foreground mb-8">
                        It takes less than 2 minutes to join and get your unique referral link.
                    </p>
                    <Link href="/partner-dashboard">
                        <Button size="lg" className="w-full sm:w-auto text-lg px-12">
                            Join Partner Program Now
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    );
}

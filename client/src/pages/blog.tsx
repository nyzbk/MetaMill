
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function Blog() {
  const posts = [
    {
      id: 1,
      title: "How to Grow on Threads in 2026",
      excerpt: "The algorithm has changed. Here are the 5 key strategies you need to know to go viral this year.",
      category: "Growth",
      date: "Feb 18, 2026",
      readTime: "5 min read",
      image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    {
      id: 2,
      title: "AI Automation for Threads: A Complete Guide",
      excerpt: "Stop spending hours writing posts. Learn how to set up an automated content machine using MetaMill.",
      category: "Automation",
      date: "Feb 15, 2026",
      readTime: "8 min read",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    {
      id: 3,
      title: "Case Study: From 0 to 10k Followers in 30 Days",
      excerpt: "Real numbers, real strategies. How one MetaMill user cracked the code and built a massive audience.",
      category: "Case Study",
      date: "Feb 10, 2026",
      readTime: "6 min read",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    }
  ];

  return (
    <div className="min-h-screen bg-background py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Resources</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
            MetaMill Blog
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Insights on Threads marketing, AI automation, and growth strategies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Card key={post.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 w-full overflow-hidden">
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
              <CardHeader>
                <div className="flex justify-between items-center mb-2">
                  <Badge variant="secondary">{post.category}</Badge>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <CalendarDays className="mr-1 h-3 w-3" />
                    {post.date}
                  </div>
                </div>
                <CardTitle className="line-clamp-2 hover:text-primary transition-colors cursor-pointer">
                  {post.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-3">
                  {post.excerpt}
                </CardDescription>
              </CardContent>
              <CardFooter className="mt-auto border-t pt-4">
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs text-muted-foreground">{post.readTime}</span>
                  <Button variant="ghost" size="sm" className="gap-1">
                    Read More <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

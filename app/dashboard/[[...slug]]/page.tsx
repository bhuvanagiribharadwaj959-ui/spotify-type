import Dashboard from "../../components/dashboard";

export default async function DashboardPage(props: { params: Promise<{ slug?: string[] }> }) {
    const params = await props.params;
    return <Dashboard slug={params.slug} />
}
